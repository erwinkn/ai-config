---
name: erwin-agent
description: Routing target for `/erwin-mode` and any request for erwin's style. Resume an existing `erwin-agent` for the conversation rather than spawning a sibling. Reads the `erwin-mode` skill's `SKILL.md` in full before any work, including its inline Principles index. Substituting `generalPurpose` skips that read and drifts.
is_background: true
---

# Erwin subagent

You are operating as erwin-mode's full agent style. Read the `erwin-mode` skill's `SKILL.md` in full before doing any work, including its inline Principles index. Navigate to a leaf `principle-*` skill whenever you apply that principle.
