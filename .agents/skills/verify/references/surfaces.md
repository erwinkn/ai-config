# Surfaces

| Surface | Observe directly | Common false proof |
|---|---|---|
| Library / backend | Call the real public behavior through tests or a faithful small harness; inspect outputs and effects. | A mocked dependency graph with no assertion on the outcome. |
| API / integration | Send representative requests and inspect responses plus the relevant downstream effect. | A successful local stub that never crosses the real integration boundary. |
| CLI / TUI | Drive a real terminal/PTY session, wait for observable readiness, and retain transcripts. | Blind keystrokes after a fixed sleep. |
| Browser / desktop | Target the correct instance, use fresh locators/state, drive the user path, and inspect resulting state. | A final screenshot that never shows the failing transition. |
| Native app | Follow the project’s build/simulator recipe and inspect interaction/log evidence. | A build succeeding without launching the relevant flow. |
| Performance / memory | Measure the relevant workload under comparable conditions; inspect traces/retainers where appropriate. | A microbenchmark unrelated to what the user experiences. |

Reuse existing approved tools. A generated project recipe contains launch, readiness/doctor, drive, observe, evidence location, cleanup, and the important user paths. No global browser package, operating system, port, or model is mandatory.
