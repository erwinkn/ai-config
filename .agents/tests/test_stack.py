"""Offline wiring tests. No provider calls and no native credentials."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.agents/scripts'))
import check
import record
import render_agents


class StackTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / 'repo'
        shutil.copytree(ROOT, self.root, symlinks=True,
                        ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__'))

    def tearDown(self):
        self.tmp.cleanup()

    def test_complete_stack(self):
        self.assertEqual(check.validate(self.root), [])

    def test_render_is_idempotent(self):
        before = render_agents.outputs(self.root)
        self.assertEqual(render_agents.render(self.root), [])
        self.assertEqual(before, render_agents.outputs(self.root))
        self.assertEqual(render_agents.render(self.root, check=True), [])

    def test_model_change_reaches_its_native_definition(self):
        path = self.root / '.agents/agents/implementer.md'
        path.write_text(path.read_text().replace('gpt-5.6-sol', 'gpt-5.6-terra'))
        self.assertTrue(render_agents.render(self.root, check=True))
        self.assertEqual(render_agents.render(self.root), [])
        native = tomllib.loads((self.root / '.codex/agents/implementer.toml').read_text())
        self.assertEqual(native['model'], 'gpt-5.6-terra')

    def test_foreign_providers_are_explicit_bridges(self):
        result = render_agents.outputs(self.root)
        claude = result[self.root / '.claude/agents/implementer-deep.md']
        self.assertEqual(check.metadata(claude)['model'], 'claude-fable-5-1')
        self.assertIn('execution bridge', claude)
        self.assertIn('gpt-6-astra', claude)
        codex = tomllib.loads(result[self.root / '.codex/agents/designer.toml'])
        self.assertEqual(codex['model'], 'gpt-5.6-luna')
        self.assertIn('claude-fable-5-1', codex['developer_instructions'])
        self.assertNotIn('sandbox_mode', codex)

    def test_native_read_roles_have_restrictive_modes(self):
        codex = tomllib.loads((self.root / '.codex/agents/scout.toml').read_text())
        self.assertEqual(codex['sandbox_mode'], 'read-only')
        claude = check.metadata((self.root / '.claude/agents/reviewer.md').read_text())
        self.assertEqual(claude['permissionMode'], 'plan')

    def test_unknown_runner_rejected(self):
        path = self.root / '.agents/agents/scout.md'
        path.write_text(path.read_text().replace('runner: "codex"', 'runner: "imaginary"'))
        with self.assertRaises(ValueError):
            render_agents.outputs(self.root)

    def test_generated_symlink_not_overwritten(self):
        path = self.root / '.claude/agents/reviewer.md'
        outside = Path(self.tmp.name) / 'private.md'
        outside.write_text('unchanged')
        path.unlink()
        path.symlink_to(outside)
        self.assertTrue(render_agents.render(self.root))
        self.assertEqual(outside.read_text(), 'unchanged')

    def test_unexpected_native_role_not_silently_deleted(self):
        path = self.root / '.claude/agents/user-added.md'
        path.write_text('user-owned')
        self.assertTrue(render_agents.render(self.root))
        self.assertEqual(path.read_text(), 'user-owned')

    def test_missing_reference_detected(self):
        (self.root / '.agents/skills/principles/references/causes.md').unlink()
        self.assertTrue(any('Missing target' in e for e in check.validate(self.root)))

    def test_missing_anchor_detected(self):
        path = self.root / '.agents/skills/research/SKILL.md'
        path.write_text(path.read_text().replace('#mechanisms)', '#nonexistent-anchor)'))
        self.assertTrue(any('Missing anchor' in e for e in check.validate(self.root)))

    def test_missing_source_row_detected(self):
        path = self.root / 'docs/agent-stack/source-map.json'
        data = json.loads(path.read_text())
        data['mappings'].pop()
        path.write_text(json.dumps(data))
        self.assertTrue(any('252' in e for e in check.validate(self.root)))

    def test_manual_codex_policy_required(self):
        path = self.root / '.agents/skills/rewrite/agents/openai.yaml'
        path.write_text('policy:\n  allow_implicit_invocation: true\n')
        self.assertTrue(any('Codex invocation policy wrong: rewrite' in e for e in check.validate(self.root)))

    def test_manual_claude_policy_required(self):
        path = self.root / '.agents/skills/setup/SKILL.md'
        path.write_text(path.read_text().replace('disable-model-invocation: true', 'disable-model-invocation: false'))
        self.assertTrue(any('Manual invocation policy wrong: setup' in e for e in check.validate(self.root)))

    def test_renderer_never_changes_cursor(self):
        folders = [self.root / '.cursor', self.root / '.cursor-plugin']
        def snapshot():
            return {str(p): p.read_bytes() for top in folders for p in top.rglob('*') if p.is_file()}
        before = snapshot()
        render_agents.render(self.root)
        self.assertEqual(before, snapshot())

    def test_log_preserves_prior_events(self):
        path = self.root / 'docs/audits/task/decisions.tsv'
        values = dict(phase='debug', actor='analyst', decision='Try X', reason='Measured signal',
                      evidence='repro.txt', outcome='Hypothesis rejected', status='refuted')
        self.assertEqual(record.append(path, values), 'D0001')
        original = path.read_text()
        self.assertEqual(record.append(path, {**values, 'decision': 'Correct D0001'}), 'D0002')
        self.assertTrue(path.read_text().startswith(original))
        self.assertIn('(recorded)', original)

    def test_log_sanitizes_formulas_and_line_breaks(self):
        self.assertEqual(record.cell('=1+2\nnext\tcell'), "'=1+2 next cell")
        self.assertEqual(record.cell('@someone'), "'@someone")

    def test_log_rejects_incompatible_history(self):
        path = self.root / 'old.tsv'
        path.write_text('other\tschema\n')
        with self.assertRaises(ValueError):
            record.append(path, {})
        self.assertEqual(path.read_text(), 'other\tschema\n')

    def test_log_rejects_symlink(self):
        outside = Path(self.tmp.name) / 'other.tsv'
        outside.write_text('keep')
        path = self.root / 'log.tsv'
        path.symlink_to(outside)
        with self.assertRaises(ValueError):
            record.append(path, {})
        self.assertEqual(outside.read_text(), 'keep')

    def test_empty_log_receives_header(self):
        path = self.root / 'new.tsv'
        path.touch()
        values = {k: 'example' for k in record.FIELDS[2:]}
        record.append(path, values)
        self.assertEqual(path.read_text().splitlines()[0], '\t'.join(record.FIELDS))

    def test_all_python_recipes_parse(self):
        self.assertFalse(any('Invalid Python' in e for e in check.validate(self.root)))


if __name__ == '__main__':
    unittest.main()
