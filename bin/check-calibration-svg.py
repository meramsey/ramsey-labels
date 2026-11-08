#!/usr/bin/env python3
"""Independently verify calibration-sheet geometry and raster dimensions."""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

source = pathlib.Path(sys.argv[1])
png = pathlib.Path(sys.argv[2])
root = ET.fromstring(source.read_bytes())
if root.tag != '{http://www.w3.org/2000/svg}svg':
    raise SystemExit('Not an SVG document')
ns = {'s': 'http://www.w3.org/2000/svg'}
metadata = json.loads(root.findtext('s:metadata', namespaces=ns))
if len(metadata['slots']) != metadata['rows'] * metadata['columns']:
    raise SystemExit('Calibration mark count disagrees with the configured grid')
width = metadata['labelWidthMm']
height = metadata['labelHeightMm']
for slot in metadata['slots']:
    if slot['x'] < -1e-6 or slot['y'] < -1e-6 or slot['x'] + width > metadata['widthMm'] + 1e-6 or slot['y'] + height > metadata['heightMm'] + 1e-6:
        raise SystemExit('A calibration label lies outside the sheet')
if [slot['skipped'] for slot in metadata['slots']].count(True) != metadata['startSlot']:
    raise SystemExit('Calibration skip-slot marks disagree with the profile')
for node in root.iter():
    if any(name.lower().startswith('on') for name in node.attrib):
        raise SystemExit('Executable event handler found in calibration SVG')
    if node.tag.endswith(('script', 'foreignObject')):
        raise SystemExit('Executable/foreign content found in calibration SVG')
    for name, value in node.attrib.items():
        if name.endswith('href') and not value.startswith('data:image/'):
            raise SystemExit('External image reference found in calibration SVG')
        if 'url(' in value and not re.fullmatch(r'url\(#[A-Za-z0-9_.:-]+\)', value):
            raise SystemExit('External resource reference found in calibration SVG')
renderer = 'ImageMagick'
if shutil.which('rsvg-convert'):
    renderer = 'librsvg'
    subprocess.run(['rsvg-convert', '--dpi-x', '150', '--dpi-y', '150', '--output', str(png), str(source)], check=True)
else:
    subprocess.run(['convert', '-background', 'white', '-density', '150', str(source), str(png)], check=True)
actual = tuple(map(int, subprocess.check_output(['identify', '-format', '%wx%h', str(png)], text=True).split('x')))
expected = (round(metadata['widthMm'] * 150 / 25.4), round(metadata['heightMm'] * 150 / 25.4))
if any(abs(a - e) > 1 for a, e in zip(actual, expected)):
    raise SystemExit(f'Calibration raster {actual} does not match physical sheet {expected}')
print(f"PASS: {len(metadata['slots'])} grid marks, {metadata['startSlot']} skipped positions, no external resources; {renderer} raster {actual} matches page mm geometry.")
