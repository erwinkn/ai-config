#!/usr/bin/env python3
"""Append one decision event; exclusive lead ownership is required."""
from __future__ import annotations
import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ('id', 'time', 'phase', 'actor', 'decision', 'reason', 'evidence', 'outcome', 'status')


def cell(value):
    value = value.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ').strip()
    return "'" + value if value.startswith(('=', '+', '-', '@')) else value


def append(file, values):
    if file.is_symlink():
        raise ValueError('Refusing a symlinked log')
    old = []
    if file.exists() and file.stat().st_size:
        with file.open(newline='', encoding='utf-8') as source:
            reader = csv.DictReader(source, delimiter='\t')
            if tuple(reader.fieldnames or ()) != FIELDS:
                raise ValueError('Existing log has a different schema; migrate explicitly')
            old = list(reader)
    ids = {row['id'] for row in old}
    number = len(old) + 1
    while f'D{number:04d}' in ids:
        number += 1
    identifier = f'D{number:04d}'
    row = {'id': identifier,
           'time': datetime.now(timezone.utc).isoformat(timespec='seconds') + ' (recorded)',
           **{key: cell(values[key]) for key in FIELDS[2:]}}
    file.parent.mkdir(parents=True, exist_ok=True)
    with file.open('a', newline='', encoding='utf-8') as target:
        writer = csv.DictWriter(target, fieldnames=FIELDS, delimiter='\t', lineterminator='\n')
        if target.tell() == 0:
            writer.writeheader()
        writer.writerow(row)
    return identifier


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    for field in FIELDS[2:]:
        parser.add_argument('--' + field, required=True)
    args = parser.parse_args()
    try:
        print(append(args.file, vars(args)))
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f'Log event not written: {exc}\n')
