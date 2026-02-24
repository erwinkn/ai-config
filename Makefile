SHELL := /bin/zsh

.PHONY: sync-home publish

sync-home:
	@zsh -ic 'ai pull --ff-only'

publish:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make publish MSG='commit message'"; \
		exit 1; \
	fi
	@git add -A
	@git commit -m "$(MSG)"
	@git push
	@zsh -ic 'ai pull --ff-only'

