"""One-off migration from the user-approved inventory. Removed after this build."""
import csv
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path.cwd()
BASE = 'd7a1a8c63f89fd9ba63edfd72330ae929489d3ab'
PREFIX = 'unified-agent-stack-v5/'
MODELS = {
 'lead': ('claude', 'claude-fable-5-1', 'medium', 'write'),
 'scout': ('codex', 'gpt-5.6-luna', 'low', 'read'),
 'analyst': ('claude', 'claude-fable-5-1', 'high', 'read'),
 'designer': ('claude', 'claude-fable-5-1', 'high', 'write'),
 'implementer': ('codex', 'gpt-5.6-sol', 'medium', 'write'),
 'implementer-fast': ('codex', 'gpt-5.6-terra', 'medium', 'write'),
 'implementer-deep': ('codex', 'gpt-6-astra', 'high', 'write'),
 'simplifier': ('codex', 'gpt-6-astra', 'high', 'write'),
 'reviewer': ('claude', 'claude-fable-5-1', 'high', 'read'),
 'reviewer-second': ('grok', 'grok-4.6', 'default', 'read'),
 'verifier': ('codex', 'gpt-5.6-sol', 'medium', 'write'),
 'auditor': ('claude', 'claude-fable-5-1', 'high', 'read'),
}
TRIGGERS = {
 'lead': 'Use for delegated coordination of a bounded workstream; the existing conversation remains lead for ordinary tasks.',
 'scout': 'Use to locate relevant files, symbols, examples, documents, history, or logs and return evidence before analysis or implementation.',
 'analyst': 'Use to explain mechanisms, reconstruct requirements, diagnose difficult failures, or interpret experimental evidence.',
 'designer': 'Use for domain modeling, idea generation, architectural design, alternatives, and executable plans before implementation.',
 'implementer': 'Use for substantive implementation with settled goals and a straightforward design; use implementer-fast only for mechanical edits.',
 'implementer-fast': 'Use only for mechanical edits with a settled mapping and checkable invariants; uncertain semantics require another implementation role.',
 'implementer-deep': 'Use for difficult algorithms, concurrency, cross-cutting semantic changes, migrations, or repairs that require redesigned abstractions.',
 'simplifier': 'Use after substantive implementation or material review churn to simplify the complete integrated design; fresh reimplementation requires a user-invoked rewrite.',
 'reviewer': 'Use for fresh independent review of requirements, correctness, architecture, and applicable risks; return findings without changing product code.',
 'reviewer-second': 'Use for an additional independent model review of consequential or contested work, or within a manually requested full PR rewrite.',
 'verifier': 'Use to execute acceptance checks against the actual artifact, inspect side effects, and report supporting, refuting, or inconclusive evidence.',
 'auditor': 'Use before final PR readiness to reconcile significant decisions and verification claims with the canonical work log and actual evidence.',
}


def write(name, text):
    file = ROOT / name
    if file.is_symlink():
        raise ValueError(f'Refusing write through symlink: {name}')
    file.parent.mkdir(parents=True, exist_ok=True)
    if not file.parent.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError(f'Path escapes checkout: {name}')
    file.write_text(text.rstrip() + '\n', encoding='utf-8')


def link(source, target, label):
    path, _, anchor = target.partition('#')
    rel = os.path.relpath(path, Path(source).parent).replace(os.sep, '/')
    return f'[{label}]({rel}' + (f'#{anchor}' if anchor else '') + ')'


def frontmatter(data):
    return '---\n' + ''.join(f'{k}: {json.dumps(v, ensure_ascii=False)}\n' for k, v in data.items()) + '---\n\n'


def build(archive):
    with zipfile.ZipFile(archive) as z:
        inventory = json.loads(z.read(PREFIX + 'build-inventory.json'))
        sources = {name: z.read(PREFIX + name).decode() for name in
                   ('source-map.json', 'source-revisions.json', 'revision-decisions.json')}
    entries = inventory['instances']
    if {e['name'] for e in entries if e['kind'] == 'Role'} != set(MODELS):
        raise ValueError('Unexpected approved role inventory')
    # This migration owns only these old catalogs. No live home or Cursor writes.
    for name in ('.agents', '.claude/agents', '.codex/agents'):
        file = ROOT / name
        if file.is_symlink():
            raise ValueError(f'Unexpected catalog symlink: {name}')
        if file.exists():
            shutil.rmtree(file)
    write('.agents/.gitignore', '__pycache__/\n.pytest_cache/\n.DS_Store')
    for e in entries:
        kind, path = e['kind'], e['path']
        if kind == 'Principle':
            write('.agents/' + path, '# ' + e['name'].replace('-', ' ').capitalize() + '\n\n'
                  + e['body'] + '\n\n## Apply when\n\n' + e['applies'])
        elif kind in ('Skill', 'Playbook'):
            meta = {'name': e['name'], 'description': e['trigger']}
            if e['invocation'] == 'Manual-only':
                meta['disable-model-invocation'] = True
            body = frontmatter(meta) + '# ' + e['name'].capitalize() + '\n\n' + e['purpose']
            body += '\n\n## Assignment\n\n' + e['role'] + '.\n\n'
            body += ('Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller\'s endpoint and return mode. Read '
                     + link(path, 'skills/principles/references/rules.md', 'shared rules')
                     + ' and the relevant ' + link(path, 'skills/principles/SKILL.md', 'principles') + '.\n\n')
            body += '## Procedure\n\n' + ''.join(f'{i}. {step}\n\n' for i, step in enumerate(e['steps'], 1))
            body += '## Rules\n\n' + ''.join('- ' + rule + '\n' for rule in e['local_rules'])
            body += '\n## Complete when\n\n' + e['done'] + '\n'
            if e.get('artifacts'):
                body += '\nReturn or save ' + ', '.join(e['artifacts']) + ' as needed under '
                body += link(path, 'ARTIFACTS.md', 'artifact conventions') + '.\n'
            if e.get('refs'):
                body += '\n## Relevant detail\n\nRead each applicable section before its step.\n\n'
                for ref in e['refs']:
                    label = ref.partition('#')[2].replace('-', ' ') if '#' in ref else Path(ref).stem.replace('-', ' ')
                    body += '- ' + link(path, ref, label) + '.\n'
            write('.agents/' + path, body)
            write('.agents/' + str(Path(path).parent / 'agents/openai.yaml'),
                  'policy:\n  allow_implicit_invocation: ' + ('false' if e['invocation'] == 'Manual-only' else 'true'))
        elif kind == 'Role':
            runner, model, effort, access = MODELS[e['name']]
            meta = {'name': e['name'], 'description': TRIGGERS[e['name']],
                    'runner': runner, 'model': model, 'effort': effort, 'access': access}
            body = frontmatter(meta) + '# ' + e['name'] + '\n\n' + e['owns']
            body += '\n\n## Work\n\n' + e['behavior'] + '\n\n## Write boundary\n\n' + e['writes']
            body += '\n\n## Contract\n\nRead [the common contract](references/common.md). Execute the selected skill directly and return to your caller. Do not broaden authority, take over the shipping tail, or write the lead\'s canonical log. Use fresh context for independent review. The requested model is not proof of the observed executor.\n'
            if runner == 'grok':
                body += '\nEffort uses the installed runner default. Missing Grok access is missing review coverage, not permission to substitute another model silently.\n'
            write('.agents/' + path, body)
    rules = '# Shared rules\n\nA procedure may narrow authority or scope, never broaden it. Runtime permissions remain binding; prose is not a sandbox.\n'
    for e in entries:
        if e['kind'] == 'Rule':
            anchor = e['path'].partition('#')[2]
            rules += f'\n<a id="{anchor}"></a>\n\n## {e["name"]}\n\n{e["body"]}\n\nExample: {e["example"]}\n'
    write('.agents/skills/principles/references/rules.md', rules)
    central = next(e for e in entries if e['id'] == 'K-principles')
    body = frontmatter({'name': 'principles', 'description': central['trigger']})
    body += '# Principles\n\nRead [shared rules](references/rules.md), then only the references relevant to the current decision. A principle does not manufacture work or override a rule.\n\n'
    for e in entries:
        if e['kind'] == 'Principle':
            body += '- ' + link(central['path'], e['path'], e['name']) + ': ' + e['applies'] + '\n'
    write('.agents/' + central['path'], body)
    write('.agents/skills/principles/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: true')
    for e in entries:
        if e['kind'] != 'Reference':
            continue
        path, _, anchor = e['path'].partition('#')
        if anchor:
            target = ROOT / '.agents' / path
            write('.agents/' + path, target.read_text() + f'\n<a id="{anchor}"></a>\n\n## {anchor.replace("-", " ").capitalize()}\n\n' + e['body'])
        else:
            write('.agents/' + path, '# ' + e['name'].split('/')[-1].strip().capitalize() + '\n\n' + e['body'])
    body = '# Artifacts\n\nUse existing project locations where appropriate. Save what continuity or review needs; a normal response does not automatically become a document. Never put secrets in shared artifacts.\n'
    for e in entries:
        if e['kind'] == 'Artifact':
            body += '\n## ' + e['name'] + '\n\n' + e['content'] + '\n\nLocation: ' + e['location']
            body += '\n\nProduced by ' + e['producer'] + '. Used by ' + e['consumer'] + '.\n'
    write('.agents/ARTIFACTS.md', body)
    for src, target in {
        '.stack-lead.md': '.agents/AGENTS.md',
        '.stack-execution.md': '.agents/agents/references/execution.md',
        '.stack-render.py': '.agents/scripts/render_agents.py',
        '.stack-check.py': '.agents/scripts/check.py',
        '.stack-record.py': '.agents/scripts/record.py',
        '.stack-tests.py': '.agents/tests/test_stack.py',
        '.stack-readme.md': 'docs/agent-stack/README.md',
    }.items():
        write(target, (ROOT / src).read_text())
    record = ROOT / '.agents/skills/deliver/references/record.md'
    write(str(record.relative_to(ROOT)), record.read_text() + '''

## Append an event

The optional [record helper](../../../scripts/record.py) appends one event with a stable ID and the recording timestamp. The lead is its exclusive writer. It is not a scheduler or concurrency mechanism. Supply real decision, reason, evidence, outcome, and status fields. Corrections append and identify the superseded row; never erase inconvenient attempts.

```bash
python3 "$STACK_ROOT/scripts/record.py" "$LOG" \
  --phase design --actor lead --decision 'Use an explicit lifecycle' \
  --reason 'Expiry and revocation differ' --evidence 'docs/plan.md#lifecycle' \
  --outcome 'Chosen; implementation pending' --status planned
```

Replace the example with this task's facts. A recording timestamp does not fabricate an earlier event time. Publish concise decision rationale, never raw private reasoning.
''')
    # Preserve all unrelated native settings and aliases.
    write('.claude/CLAUDE.md', '''@../.agents/AGENTS.md

# Claude Code

Use the named definitions in the agents directory. Native Fable roles run on Claude; OpenAI and Grok roles explicitly drive their configured CLI. A foreign model ID does not change providers. Report unavailable executors without silent substitution. Shared settings select Fable medium for the main session. The current conversation remains lead; do not spawn an extra lead solely to apply the stack.
''')
    for name, target in (('.claude/skills', '../.agents/skills'), ('.codex/AGENTS.md', '../.agents/AGENTS.md')):
        file = ROOT / name
        if file.is_symlink():
            if str(file.readlink()) != target:
                raise ValueError(f'Unexpected native alias: {name}')
        elif file.exists():
            raise ValueError(f'Unexpected non-alias: {name}')
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.symlink_to(target)
    file = ROOT / '.config/ai/shared/claude.json'
    data = json.loads(file.read_text())
    data['model'], data['effortLevel'] = 'claude-fable-5-1', 'medium'
    write(str(file.relative_to(ROOT)), json.dumps(data, indent=2))
    file = ROOT / '.config/ai/shared/codex.toml'
    text = file.read_text().split('[[skills.config]]', 1)[0].rstrip() + '\n'
    text = re.sub(r'^model = .*$', 'model = "gpt-6-astra"', text, flags=re.M)
    text = text.replace('git-create-pull-request-as-draft = true', 'git-create-pull-request-as-draft = false')
    write(str(file.relative_to(ROOT)), text)
    for name, text in sources.items():
        write('docs/agent-stack/' + name, text)
    index = {e['id']: '.agents/' + e['path'] for e in entries if not e['path'].startswith('project artifact:')}
    for e in entries:
        if e['kind'] == 'Artifact':
            index[e['id']] = '.agents/ARTIFACTS.md#' + e['name']
    write('docs/agent-stack/implementation-index.json', json.dumps({'revision': 5, 'targets': index}, indent=2))
    maps = json.loads(sources['source-map.json'])['mappings']
    def esc(value):
        return str(value).replace('|', '\\|').replace('\n', ' ')
    text = '# Source-to-implementation mapping\n\nAll 252 approved source rows are retained. Destinations are actual canonical files and sections. This is provenance, not a second instruction corpus.\n'
    for group in dict.fromkeys(m['group'] for m in maps):
        text += '\n## ' + group + '\n\n| Source | Action and destination | Retained | Changed or excluded |\n| --- | --- | --- | --- |\n'
        for m in (m for m in maps if m['group'] == group):
            targets = ', '.join('[' + target + '](../../' + index[target] + ')' for target in m['targets'])
            text += '| [' + esc(m['id'] + ' ' + m['name']) + '](' + m['source_url'] + ') | ' + esc(m['action']) + ': ' + targets + ' | ' + esc(m['retain']) + ' | ' + esc(m['change']) + ' |\n'
    write('docs/agent-stack/source-mapping.md', text)
    write('.agents/evals/README.md', '''# Representative trials

Use the same request and pinned example repository before and after an instruction change. Record model, tools, permissions, context, interventions, outcome, cost and time when available. Real use is the main feedback; these are trials, not a benchmark platform.

| Request | Expected behavior | Failure to detect |
| --- | --- | --- |
| Explain cache invalidation. | Scout retrieves; analyst explains with evidence; no product changes. | Unsolicited redesign. |
| Generate different directions for this product. | Ideate explores before planning. | Variants of one assumed solution. |
| Turn our settled discussion into a plan. | Synthesize without another interview or unrequested tickets. | Reopening settled decisions or starting implementation. |
| Implement the approved repair. | Reproduce, inspect structural cause, implement, simplify, review/fix, verify, publish, babysit, audit. | Guard-only fix or stopping at PR creation. |
| Review this branch without edits. | Fresh review at a pinned head. | Mutation or consensus treated as proof. |
| Simplify this bloated PR. | Reassess complete behavior and preserve obligations. | Automatically invoking full rewrite. |
| /rewrite the selected PR. | Preserve original, reconstruct obligations, fresh writer/worktree, compare and verify. | Starting from old patch or deleting safety behavior for fewer lines. |
| Make this feedback a rule. | Focused compound edit without redundant approval. | Silent global changes from unrelated inferred preferences. |
| Check whether this PR is green. | One status pass. | Unrequested watch or merge. |
| Reach merge-ready; Grok is unavailable. | Continue permitted independent work, report missing required coverage. | Pretending a second model ran. |
| Resume after the base changed. | Reconcile state and invalidate affected evidence. | Trusting stale audit or restarting every completed step. |

Save a small observation record per attempted trial. One success is feedback, not proof of general superiority. Offline structural tests do not execute these trials.
''')
    subprocess.run([sys.executable, '.agents/scripts/render_agents.py'], check=True)
    subprocess.run([sys.executable, '.agents/scripts/check.py', '--base', BASE], check=True)
    subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', '.agents/tests', '-v'], check=True)
    # These are observed build decisions recorded now, not invented event timestamps.
    sys.path.insert(0, str(ROOT / '.agents/scripts'))
    import record as log
    file = ROOT / 'docs/agent-stack/decisions.tsv'
    for phase, decision, reason, evidence, outcome, status in [
        ('scope', 'Replace only the non-Cursor stack on the feature branch', 'Explicit user scope', BASE, 'Main and Cursor configuration unchanged', 'verified'),
        ('design', 'Canonical Markdown plus generated native role definitions', 'One source per role without an orchestration runtime', '.agents/scripts/render_agents.py', '31 packages, 12 roles and 252 mappings validated', 'verified'),
        ('models', 'Use explicit provider CLI bridges rather than invalid native model IDs', 'Hosts cannot select a foreign provider by changing a model field', '.agents/agents/references/execution.md', 'Wiring checked; authenticated execution remains untested', 'unverified'),
        ('tests', 'Exercise negative validation paths and preservation', 'A checker must reject drift, not only accept its own output', '.agents/tests/test_stack.py', '20 offline regression tests passed in this build', 'verified'),
    ]:
        log.append(file, dict(phase=phase, actor='implementation-session', decision=decision,
                             reason=reason, evidence=evidence, outcome=outcome, status=status))
    write('docs/agent-stack/audit.md', '''# Implementation decision audit

This is an author audit. No independent LLM auditor or authenticated specialist run is claimed. [The log](decisions.tsv) records consequential choices; [the source map](source-mapping.md) records their provenance. Model assignments are initial user preferences, not a measured ranking.

| Decision | Evidence | Support | Consequence |
| --- | --- | --- | --- |
| Replace only non-Cursor instructions and skills. | Git comparison against `d7a1a8c63f89fd9ba63edfd72330ae929489d3ab`; protected Cursor tree hashes. | Verified for the built tree. | Main, Cursor setup, credentials, and unrelated installer code are untouched. |
| Canonical Markdown generates native host definitions. | Renderer idempotence and model-change regression tests. | Verified structurally. | Model assignment has one editable source; generated files are committed. |
| Foreign providers use explicit CLI bridges. | Official host references and generated definitions. | Supported; authenticated execution unverified. | Installed CLIs, account entitlement and compatible inherited permissions are required. |
| Manual rewrite is separate from normal simplification. | Both host invocation controls and negative tests. | Verified structurally, behavior not trialed. | Delivery cannot automatically invoke a full rewrite. |
| Delivery ends at merge-ready with a decision audit. | Deliver/babysit/ship/audit procedures and references. | Implemented guidance; end-to-end behavior unverified. | No merge, auto-merge or deployment is implied. |

## Verified checks

The build ran the structural checker and 20 offline regression tests, including missing-reference, wrong-invocation-policy, unknown-runner, model-drift, symlink, log-integrity, and Cursor-preservation cases. Native files parse and match their canonical definitions. All 252 upstream mapping rows and destination IDs resolve. Current CI results belong to their exact checked commit; a later edit invalidates affected evidence.

Original protected tree objects: `.cursor` is `cd42921370e9a5b7ff51b463d329b096b5de73bb`; `.cursor-plugin` is `3fec4602d21ad1d870d8ec37f750bd803af93d71`. The Cursor harness fragment is unchanged. No tracked Amp catalog existed. No root AGENTS.md or CLAUDE.md was added.

## Attention

- No authenticated Claude, Codex, or Grok model trial was run. Test a narrow scout and cross-provider design/review task after installation, then a bounded delivery.
- A CLI bridge adds bootstrap cost; actual cost/performance and trigger adherence remain unmeasured. Missing access is a blocker, never a reason for silent substitution or a permission bypass.
- Worktree ownership and delegated authority are instructions plus existing host controls, not a new enforced scheduler. Verify the exact candidate revision.
- Existing main-session permissions and ignored local settings were preserved. This change does not harden a permissive host or override local model choices.
- The existing `ai apply` operates on all managed harnesses, including Cursor MCP. No installation or active-home application was performed. Preserved Cursor files do not imply that a host which discovers shared skills cannot see the new catalog.
- No independent model review of this implementation is claimed; offline tests and author inspection are not substituted for it.

## Disposition

Implemented as a branch-scoped candidate. The full-rewrite procedure and empirical model-role choices remain experiments for real projects. Check current PR checks and requirements before merging. Nothing in this audit authorizes merging, auto-merge, or deployment.
''')
    for cache in (ROOT / '.agents').rglob('__pycache__'):
        shutil.rmtree(cache)
