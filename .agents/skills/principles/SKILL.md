---
name: principles
description: "Erwin's engineering principles; always use this skill when designing, writing, refactoring, or reviewing code."
---

# Principles

This is how I think about building software. These are defaults, not rules: use judgment, and push back when one of them doesn't fit.

## Design

- **Start from the data.** Get the state and the data structures right first, and the code mostly follows. Ask what information the system has to represent and which questions it has to answer, then choose structures for those workloads.
- **Every concept earns its place.** A new type, state value, layer, endpoint, option, or tool needs a real case it handles that nothing else can, or a real convenience for the user. Either the concept can be expressed clearly and justified, or it goes.
- **Derive, don't sync.** Store each fact once, where it originates, and derive everything else from it. Keep a copy only for a reason: a durable snapshot when the source history goes away, or a cache you can always rebuild from the source when deriving is measurably too slow.
- **Make bugs impossible by construction.** When an area keeps producing bugs, simplify the semantics or the data model until the bad states can't exist, rather than adding another rule around them. Use the type system the same way: make illegal states unrepresentable, and don't lie to it with casts.
- **One concept, one name.** Every concept gets exactly one name, and the name says what the thing is in the domain, not how it's implemented.
- **State your invariants clearly, once.** Validate external data where it enters the system, then trust its type inside.
- **Redesign as if the requirement had always been there.** Don't bolt a change onto the existing design. Ask: if we were writing this from scratch, is this what we'd build? No sunk cost.
- **Give each part one job.** Keep the core small and let each component own its own details, such as formats, storage, and dependencies. Small interfaces that report what happened beat large ones that prescribe how.
- **Experience first.** When implementation convenience conflicts with user delight, choose delight. Design from the user's workflow and mental model, and expose internals only when they help the user decide or act. The user is whoever consumes the work, including the colleague who imports your library and the engineer who maintains the code next.
- **Take the normal path.** Use the platform's and framework's ordinary mechanisms. Sometimes we do need to hack around a system, but any deviation from the standard path needs a strong justification.

## Code

- **Delete before you add.** When improving something, look for removals first. Adding to a complex system compounds the complexity; removing first leaves less code, reveals the essential structure, and usually makes the right design obvious.
- **Smallest change that reaches the right design.** Minimize the diff against the right design, not against the current code. Fewer lines beat "elegant" boilerplate.
- **Keep it flat and direct.** Avoid deep call chains, wrappers with one caller, and layers that pass the same arguments through. Each layer should change the abstraction, and an interface should hide more than it exposes. If a task asks you to thread a new signal through many layers, look for a more direct path.
- **Minimize state.** Prefer pure functions and return values over mutation, locals over fields, fields over module state, and module state over globals.
- **DRY the structure, not every line.** One rule in two places is a bug waiting to happen, and types and data models that describe the same thing should converge. Three similar-looking lines are fine, and usually better than a premature abstraction. Prefer explicit over clever.
- **Fix small leaks early.** A pass-through, a duplicated choice, or a leaked internal type is cheap to remove today and spreads if left alone.
- **Simple, not lazy.** Simplify to get to the core of what the system must do, never by dropping behavior, exactness, or a real safety boundary.
- **Minimize reader load.** Code is read far more than it's written. Lines of code and cyclomatic complexity are useful proxies. If a human would find the code exhausting to maintain, it's a bad solution.

## Work

- **Settle the design before polishing.** Don't debug, test, or tune a mechanism that the design is about to replace.
- **Fix the root cause.** Don't route around a problem. When the root cause is small and nearby, fix it in the same change; when it's large, give it its own.
- **Tooling first.** If something helps every later phase, do it first. Ask "does every subsequent phase benefit from this existing?" Examples: CI, linting, test infrastructure, shared types.
- **Measure the real thing.** Optimize the costs that matter where the system actually runs. Compare against the naive version before adding complexity, and distrust a surprising number until you understand it.
- **Prove it works where it runs.** Exercise the real behavior in the running system, including the UI a backend change serves. Test behavior and edge cases, not line counts. "It compiles" and "tests pass" are not proof on their own.
- **Explain with examples.** When proposing a design or a removal, walk through a concrete example with real data, and show what happens with and without the change.

## Questions I keep asking

- Why do we even need this?
- Can this be derived from what we already have?
- What information do we actually need to represent, and which questions do we need to answer?
- If we were building this from scratch, is this what we'd pick?
- What can we delete?
- Is this more general than what we really need?
- Is there a normal way to do this instead of a workaround?
