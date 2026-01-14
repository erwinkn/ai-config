# Dotfiles Improvement Workflow

Analyze my system and suggest improvements to my dotfiles configuration.

## Step 1: Analyze Current State

Read and analyze these configuration files:
- `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.profile`
- `~/.gitconfig`
- `~/.tmux.conf`
- `~/.ssh/config`
- `~/.config/nvim/init.lua` (if exists)
- `~/.config/ghostty/config` (if exists)

## Step 2: Analyze Usage Patterns

Examine my recent shell history to understand:
- Most frequently used commands
- Repetitive command patterns that could benefit from aliases
- Tools I use regularly

```bash
cat ~/.zsh_history | cut -d';' -f2- 2>/dev/null | sed 's/^[[:space:]]*//' | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -40
```

Also check installed tools:
```bash
brew list --formula | head -50
```

## Step 3: Suggest Improvements

Based on the analysis, suggest:
1. **New aliases** for frequently used commands
2. **Config improvements** (git settings, shell options, tmux bindings)
3. **Missing configurations** that would be useful based on installed tools
4. **Cleanup opportunities** (duplicates, unused settings, boilerplate)

Present suggestions in a clear table format with priority levels.

## Step 4: Implement (with approval)

After I approve the suggestions:
1. Make the changes to the config files
2. Stage changes with `dotfiles add <files>`
3. Commit with a descriptive message using `dotfiles commit`

## Important Notes

- Do NOT commit files containing secrets (.npmrc, .pypirc, API tokens, etc.)
- Preserve tool-managed sections (like Gitpod, Coder blocks in ssh config)
- Keep the existing dotfiles alias: `alias dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'`
- Test that oh-my-zsh plugins are valid before adding them
