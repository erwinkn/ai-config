# estack

Cursor plugin: `/erwin-mode`, GitHub stacked PRs, cloud coding agents.

## Install from this private repo

```text
/add-plugin erwinkn/ai-config
```

Or paste `https://github.com/erwinkn/ai-config` into Customize → Plugins.

Team marketplace: Dashboard → Plugins → Import from Repo → `erwinkn/ai-config`.
Marketplace source is `.cursor` so this directory is the plugin root.

The IDE clones with your local git credentials. If install creates an empty
`~/.cursor/plugins/cache` folder, delete it and retry, or use the local fallback.

## Local fallback

```sh
mkdir -p ~/.cursor/plugins/local
ln -sfn /path/to/ai-config/.cursor ~/.cursor/plugins/local/estack
```

Then Developer: Reload Window. Confirm `estack` under Customize → Plugins.
