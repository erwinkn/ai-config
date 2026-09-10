#!/usr/bin/env python3
"""Validate stack wiring and provenance. Does not run or authenticate models."""
from __future__ import annotations
import argparse
import ast
import json
from pathlib import Path
import re
import subprocess
import sys
import tomllib
from urllib.parse import unquote, urlsplit
import render_agents

ROOT = Path(__file__).resolve().parents[2]
SKILLS = set('principles research explain clarify model design prototype plan implement test diagnose review simplify verify integrate triage handoff learn ideate alternatives swarm audit discover deliver optimize babysit ship setup compound evaluate rewrite'.split())
ROLES = set('lead scout analyst designer implementer implementer-fast implementer-deep simplifier reviewer reviewer-second verifier auditor'.split())
MANUAL = {'setup', 'rewrite'}
PROTECTED = ['.cursor', '.cursor-plugin', '.config/ai/shared/harnesses/cursor.json']


def metadata(text):
    if not text.startswith('---\n'):
        raise ValueError('Missing frontmatter')
    header, _ = text[4:].split('\n---\n', 1)
    result = {}
    for line in header.splitlines():
        key, sep, value = line.partition(': ')
        if not sep or key in result:
            raise ValueError(f'Invalid/duplicate metadata: {key}')
        result[key] = json.loads(value)
    return result


def anchors(text):
    found = set(re.findall(r'<a id="([^"]+)">', text))
    for heading in re.findall(r'^#{1,6}\s+(.+)$', text, re.M):
        found.add(re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-'))
    return found


def link_error(origin, target, root):
    parts = urlsplit(target)
    if parts.scheme or target.startswith('//'):
        return None
    file = (origin.parent / unquote(parts.path)).resolve() if parts.path else origin.resolve()
    if not file.is_relative_to(root.resolve()):
        return f'Link escapes checkout: {target}'
    if not file.exists():
        return f'Missing target: {target}'
    if parts.fragment and file.is_file() and unquote(parts.fragment) not in anchors(file.read_text()):
        return f'Missing anchor: {target}'
    return None


def validate(root=ROOT):
    errors = []
    def require(condition, message):
        if not condition:
            errors.append(message)
    skills = {p.parent.name: p for p in (root / '.agents/skills').glob('*/SKILL.md')}
    require(set(skills) == SKILLS, f'Skill inventory mismatch: {set(skills) ^ SKILLS}')
    for name, file in skills.items():
        try:
            text = file.read_text()
            m = metadata(text)
            require(m.get('name') == name, f'Skill slug mismatch: {name}')
            require(isinstance(m.get('description'), str) and 0 < len(m['description']) <= 1024,
                    f'Invalid trigger: {name}')
            require(bool(m.get('disable-model-invocation', False)) == (name in MANUAL),
                    f'Manual invocation policy wrong: {name}')
            expected = 'false' if name in MANUAL else 'true'
            require((file.parent / 'agents/openai.yaml').read_text().strip() ==
                    f'policy:\n  allow_implicit_invocation: {expected}',
                    f'Codex invocation policy wrong: {name}')
            if name != 'principles':
                for heading in ('## Assignment', '## Procedure', '## Rules', '## Complete when'):
                    require(heading in text, f'Missing {heading}: {name}')
        except (OSError, ValueError, KeyError) as exc:
            errors.append(f'Invalid skill {name}: {exc}')
    for file in (root / '.agents').rglob('*.md'):
        if file.is_symlink():
            continue
        text = file.read_text()
        prose = re.sub(r'```.*?```', '', text, flags=re.S)
        for target in re.findall(r'\[[^\]]+\]\(([^\s)]+)\)', prose):
            error = link_error(file, target, root)
            if error:
                errors.append(f'{file.relative_to(root)}: {error}')
        for recipe in re.findall(r'```python\n(.*?)```', text, re.S):
            try:
                ast.parse(recipe)
            except SyntaxError as exc:
                errors.append(f'Invalid Python recipe in {file.relative_to(root)}: {exc}')
    canonical = {p.stem for p in (root / '.agents/agents').glob('*.md') if p.name != 'README.md'}
    require(canonical == ROLES, f'Role inventory mismatch: {canonical ^ ROLES}')
    try:
        errors.extend(render_agents.render(root, check=True))
        for file in (root / '.codex/agents').glob('*.toml'):
            data = tomllib.loads(file.read_text())
            require(data.get('name') == file.stem and data.get('developer_instructions'), f'Invalid native Codex role: {file}')
        for file in (root / '.claude/agents').glob('*.md'):
            data = metadata(file.read_text())
            require(data.get('name') == file.stem and data.get('description'), f'Invalid native Claude role: {file}')
        codex = tomllib.loads((root / '.config/ai/shared/codex.toml').read_text())
        claude = json.loads((root / '.config/ai/shared/claude.json').read_text())
        require(not codex.get('skills', {}).get('config'), 'Stale shared Codex skill exclusions remain')
        require(codex.get('model') == 'gpt-6-astra', 'Codex main model must be Astra for this initial build')
        require(claude.get('model') == 'claude-fable-5-1', 'Claude main model must be Fable for this initial build')
    except (OSError, ValueError) as exc:
        errors.append(f'Native configuration invalid: {exc}')
    for name, target in (('.claude/skills', '../.agents/skills'), ('.codex/AGENTS.md', '../.agents/AGENTS.md')):
        file = root / name
        require(file.is_symlink() and str(file.readlink()) == target and file.exists(), f'Invalid native alias: {name}')
    try:
        source = json.loads((root / 'docs/agent-stack/source-map.json').read_text())['mappings']
        index = json.loads((root / 'docs/agent-stack/implementation-index.json').read_text())['targets']
        require(len(source) == 252, 'Provenance must retain all 252 source rows')
        require(len({m['id'] for m in source}) == len(source), 'Duplicate source IDs')
        for m in source:
            for target in m['targets']:
                require(target in index, f'Unmapped source target: {m["id"]}: {target}')
        for key, target in index.items():
            error = link_error(root / 'index.md', target, root)
            if error:
                errors.append(f'Implementation index {key}: {error}')
    except (OSError, ValueError, KeyError) as exc:
        errors.append(f'Invalid provenance: {exc}')
    return errors


def protected_changes(root, base):
    diff = subprocess.run(['git', 'diff', '--exit-code', base, '--', *PROTECTED], cwd=root, capture_output=True)
    extra = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard', '--', *PROTECTED], cwd=root, capture_output=True)
    return ['Protected Cursor paths changed or base cannot be resolved'] if diff.returncode or extra.returncode or extra.stdout.strip() else []


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help='Optionally prove preservation of Cursor against a known git ref')
    args = parser.parse_args()
    errors = validate()
    if args.base:
        errors += protected_changes(ROOT, args.base)
    if errors:
        parser.exit(1, '\n'.join(errors) + '\n')
    print('PASS: 31 packages, 12 roles, references, native files, invocation controls, and 252 source mappings.')
    if args.base:
        print('PASS: protected Cursor paths unchanged.')
    print('Structural checks only; authenticated execution and model quality are not established.')
