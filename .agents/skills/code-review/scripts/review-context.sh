#!/bin/sh
# Resolve the context for a code review.
#
# Usage:
#   review-context.sh uncommitted
#   review-context.sh branch <base-ref>
#   review-context.sh commit <sha>
#   review-context.sh pr <ref>
#   review-context.sh folder <path>...
#
# The script prints the resolved target, the changed files, and the command
# that shows the full diff. It does not print the diff itself.

set -eu

die() {
	printf 'error: %s\n' "$1" >&2
	exit 1
}

require_repo() {
	command -v git >/dev/null 2>&1 || die "git is not installed"
	git rev-parse --git-dir >/dev/null 2>&1 || die "this directory is not inside a git repository"
}

merge_base() {
	base=$1
	upstream=$(git rev-parse --abbrev-ref "$base@{upstream}" 2>/dev/null || true)
	for candidate in "$upstream" "origin/$base" "$base"; do
		[ -n "$candidate" ] || continue
		result=$(git merge-base HEAD "$candidate" 2>/dev/null || true)
		if [ -n "$result" ]; then
			printf '%s\n' "$result"
			return 0
		fi
	done
	return 1
}

print_branch() {
	if [ -n "$1" ]; then
		printf 'branch: %s\n' "$1"
	fi
}

mode=${1:-}
[ -n "$mode" ] || die "usage: review-context.sh uncommitted|branch <ref>|commit <sha>|pr <ref>|folder <path>..."
shift

require_repo
branch=$(git branch --show-current 2>/dev/null || true)

case "$mode" in
uncommitted)
	printf 'mode: uncommitted\n'
	print_branch "$branch"
	printf 'status:\n'
	git status --short
	printf 'next:\n'
	printf '  git diff            # unstaged changes\n'
	printf '  git diff --cached   # staged changes\n'
	printf '  read every untracked file named in the status output\n'
	;;

branch)
	ref=${1:-}
	[ -n "$ref" ] || die "branch mode needs a base ref, for example: review-context.sh branch main"
	base=$(merge_base "$ref") || die "no merge base between HEAD and $ref"
	printf 'mode: branch\n'
	print_branch "$branch"
	printf 'base ref: %s\n' "$ref"
	printf 'merge base: %s\n' "$base"
	printf 'changed files:\n'
	git diff --stat "$base"
	printf 'next:\n  git diff %s\n' "$base"
	;;

commit)
	ref=${1:-}
	[ -n "$ref" ] || die "commit mode needs a revision, for example: review-context.sh commit HEAD"
	git rev-parse --verify --quiet "$ref^{commit}" >/dev/null || die "not a commit: $ref"
	printf 'mode: commit\n'
	printf 'commit: '
	git log -1 --format='%h %s' "$ref"
	printf 'changed files:\n'
	git show --stat --format= "$ref"
	printf 'next:\n  git show %s\n' "$ref"
	;;

pr)
	ref=${1:-}
	[ -n "$ref" ] || die "pr mode needs a PR number or URL"
	command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is not installed"
	gh auth status >/dev/null 2>&1 || die "gh is not authenticated, run: gh auth login"
	tracked=$(git status --porcelain | grep -v '^??' || true)
	[ -z "$tracked" ] || die "the worktree has changes to tracked files, commit or stash them first"
	base_ref=$(gh pr view "$ref" --json baseRefName --jq .baseRefName 2>/dev/null) || die "cannot read PR $ref"
	title=$(gh pr view "$ref" --json title --jq .title 2>/dev/null || true)
	gh pr checkout "$ref" >/dev/null 2>&1 || die "cannot check out PR $ref"
	head=$(git branch --show-current 2>/dev/null || true)
	base=$(merge_base "$base_ref") || die "no merge base between $head and $base_ref"
	printf 'mode: pr\n'
	printf 'pr: %s\n' "$ref"
	if [ -n "$title" ]; then
		printf 'title: %s\n' "$title"
	fi
	printf 'head branch: %s\n' "$head"
	printf 'base branch: %s\n' "$base_ref"
	printf 'merge base: %s\n' "$base"
	printf 'changed files:\n'
	git diff --stat "$base"
	printf 'next:\n  git diff %s\n' "$base"
	;;

folder)
	[ "$#" -gt 0 ] || die "folder mode needs at least one path"
	for path in "$@"; do
		[ -e "$path" ] || die "path does not exist: $path"
	done
	printf 'mode: folder\n'
	printf 'paths:\n'
	for path in "$@"; do
		printf '  %s\n' "$path"
	done
	printf 'next:\n  read the files under these paths, this is a snapshot review\n'
	;;

*)
	die "unknown mode: $mode"
	;;
esac
