---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits (oneline): !`git log --oneline -5`
- Most recent commit (full message for style reference): !`git log -1 --format='%B'`

## Your task

Based on the above changes, create a single git commit. Match the commit message style shown in the most recent commit.
