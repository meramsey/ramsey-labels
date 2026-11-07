#!/usr/bin/env python3
"""Compare generated and committed gettext catalogs, ignoring only generation timestamp."""
import difflib
import pathlib
import re
import sys


def normalize(text):
    return re.sub(r'^"POT-Creation-Date: .*?\\n"$', '"POT-Creation-Date: <generated>\\n"', text, flags=re.M)


left = pathlib.Path(sys.argv[1]).read_text()
right = pathlib.Path(sys.argv[2]).read_text()
if normalize(left) != normalize(right):
    print(''.join(difflib.unified_diff(left.splitlines(True), right.splitlines(True), fromfile='committed POT', tofile='generated POT')))
    raise SystemExit('Gettext catalog differs; regenerate and review languages/ramsey-labels-independent.pot')
print('PASS: every PHP/JavaScript gettext entry and translator comment matches the generated POT (timestamp normalized).')
