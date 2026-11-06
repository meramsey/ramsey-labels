#!/usr/bin/env python3
"""PCP emits a FILE header followed by a JSON array for each file."""
import collections
import json
import pathlib
import sys
text=pathlib.Path(sys.argv[1]).read_text()
findings=[]
for line in text.splitlines():
    if line.startswith('['): findings.extend(json.loads(line))
counts=collections.Counter(f['type'] for f in findings)
print(f"Plugin Check: {counts['ERROR']} errors, {counts['WARNING']} warnings")
if counts['ERROR']: raise SystemExit(1)
