#!/bin/sh
# Append-only decision log for the current branch.
#
# Usage:
#   decision-log.sh add <decision> <instead> <confidence> <why> <evidence>
#   decision-log.sh path
#   decision-log.sh show
#
# The log lives in the Git directory, so each worktree and branch has its own
# and Git never tracks it: $(git rev-parse --absolute-git-dir)/decisions/<branch>.tsv

set -eu

usage="usage: decision-log.sh add <decision> <instead> <confidence> <why> <evidence> | path | show"

die() {
	printf 'error: %s\n' "$1" >&2
	exit 1
}

# One line per cell: tabs and newlines would break the TSV.
cell() {
	printf '%s' "$1" | tr '\t\n\r' '   '
}

git rev-parse --git-dir >/dev/null 2>&1 || die "this directory is not inside a git repository"
branch=$(git branch --show-current)
[ -n "$branch" ] || branch=detached
log="$(git rev-parse --absolute-git-dir)/decisions/$branch.tsv"

case "${1:-}" in
path)
	printf '%s\n' "$log"
	;;

show)
	[ -f "$log" ] || die "no decision log at $log"
	column -t -s "$(printf '\t')" "$log"
	;;

add)
	[ "$#" -eq 6 ] || die "$usage"
	for value in "$2" "$3" "$5" "$6"; do
		[ -n "$value" ] || die "every cell needs a value. $usage"
	done
	case "$4" in
	high | medium | low) ;;
	*) die "confidence must be high, medium, or low" ;;
	esac
	row=$(printf '%s\t%s\t%s\t%s\t%s\t%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		"$(cell "$2")" "$(cell "$3")" "$4" "$(cell "$5")" "$(cell "$6")")
	mkdir -p "$(dirname "$log")"
	[ -f "$log" ] || printf 'ts\tdecision\tinstead\tconfidence\twhy\tevidence\n' >"$log"
	printf '%s\n' "$row" >>"$log"
	;;

*)
	die "$usage"
	;;
esac
