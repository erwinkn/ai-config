SHELL := /bin/sh

.PHONY: sync-home publish

sync-home:
	@"$$HOME/.local/bin/ai" sync

publish:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make publish MSG='commit message'"; \
		exit 1; \
	fi
	@git add -A
	@git commit -m "$(MSG)"
	@git push
	@"$$HOME/.local/bin/ai" sync
