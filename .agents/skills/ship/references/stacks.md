# Stacks

For a dependent chain, verify each change against its relevant parent and land only the contiguous acceptable prefix. Reconcile base/head changes before each landing. Patch equivalence can reduce redundant source review, but does not replace checks affected by a changed base, dependencies, or environment. Use one canonical topology writer and the existing forge tools; do not mandate Graphite or Origin. Independent PRs are not forcibly stacked. Actual merge/release authority remains explicit.
