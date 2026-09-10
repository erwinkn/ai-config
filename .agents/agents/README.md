# Role assignments

Edit a canonical role Markdown file, then run `python3 .agents/scripts/render_agents.py` from the configuration checkout. This authoring command generates files; it does not launch agents. Metadata uses the JSON-scalar subset of YAML.

| Role | Specialist runner | Model | Effort | Claude | Codex |
| --- | --- | --- | --- | --- | --- |
| [analyst](analyst.md) | claude | `claude-fable-5-1` | high | Native | CLI bridge |
| [auditor](auditor.md) | claude | `claude-fable-5-1` | high | Native | CLI bridge |
| [designer](designer.md) | claude | `claude-fable-5-1` | high | Native | CLI bridge |
| [implementer-deep](implementer-deep.md) | codex | `gpt-6-astra` | high | CLI bridge | Native |
| [implementer-fast](implementer-fast.md) | codex | `gpt-5.6-terra` | medium | CLI bridge | Native |
| [implementer](implementer.md) | codex | `gpt-5.6-sol` | medium | CLI bridge | Native |
| [lead](lead.md) | claude | `claude-fable-5-1` | medium | Native | CLI bridge |
| [reviewer-second](reviewer-second.md) | grok | `grok-4.6` | default | CLI bridge | CLI bridge |
| [reviewer](reviewer.md) | claude | `claude-fable-5-1` | high | Native | CLI bridge |
| [scout](scout.md) | codex | `gpt-5.6-luna` | low | CLI bridge | Native |
| [simplifier](simplifier.md) | codex | `gpt-6-astra` | high | CLI bridge | Native |
| [verifier](verifier.md) | codex | `gpt-5.6-sol` | medium | CLI bridge | Native |

The existing conversation remains lead. Claude starts on Fable medium; Codex starts on Astra high and delegates Fable roles when appropriate. Claude bridges bootstrap on Fable medium, Codex bridges on Luna low, then invoke the named specialist. This adds overhead; a bootstrap result is not specialist work. Grok effort uses its installed runner default. These assignments are starting preferences, not a measured ranking or proof of account entitlement.

Known deterministic operations need no model. Use fast implementation only for settled mechanical edits, ordinary implementation by default, and deep implementation for difficult semantics. A missing credential or denied tool is not a reason to select a larger model. Follow [execution](references/execution.md) for foreign-provider roles and [common instructions](references/common.md) for ownership and reporting.
