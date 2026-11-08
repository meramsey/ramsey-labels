#!/usr/bin/env python3
"""Parse and rasterize the full-label SVG with independent Python XML/ImageMagick tools."""
import base64
import pathlib
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

svg_path = pathlib.Path(sys.argv[1])
png_path = pathlib.Path(sys.argv[2])
width_mm = float(sys.argv[3])
height_mm = float(sys.argv[4])
dpi = int(sys.argv[5])
if svg_path.stat().st_size > 32_000_000:
    raise SystemExit('SVG exceeds the tested resource bound')
source = svg_path.read_bytes()
if b'<!doctype' in source.lower() or b'<!entity' in source.lower():
    raise SystemExit('SVG must not include DTDs or entity declarations')
root = ET.fromstring(source)
ns = {'s': 'http://www.w3.org/2000/svg'}
if root.tag != '{http://www.w3.org/2000/svg}svg':
    raise SystemExit('Wrong SVG root namespace')
if root.attrib.get('width') != f'{width_mm:g}mm' or root.attrib.get('height') != f'{height_mm:g}mm':
    raise SystemExit('SVG physical width/height do not match the label')
if root.attrib.get('viewBox') != f'0 0 {width_mm:g} {height_mm:g}':
    raise SystemExit('SVG viewBox does not match its physical dimensions')
ids = {node.attrib['id'] for node in root.iter() if 'id' in node.attrib}
image_count = 0
vector_barcode_rects = 0
for node in root.iter():
    if any(attribute.lower().startswith('on') for attribute in node.attrib):
        raise SystemExit('SVG contains an event-handler attribute')
    if node.tag in ('{http://www.w3.org/2000/svg}script', '{http://www.w3.org/2000/svg}foreignObject'):
        raise SystemExit('SVG contains executable or foreign content')
    for name, value in node.attrib.items():
        if name.endswith('href'):
            if node.tag != '{http://www.w3.org/2000/svg}image' or not value.startswith('data:image/png;base64,'):
                raise SystemExit('SVG contains an external or non-raster image reference')
            payload = value.split(',', 1)[1]
            base64.b64decode(payload, validate=True)
            image_count += 1
        if 'url(' in value:
            for ref in re.findall(r'url\(([^)]+)\)', value):
                if not ref.startswith('#') or ref[1:] not in ids:
                    raise SystemExit('SVG contains a non-local resource reference')
    if node.tag == '{http://www.w3.org/2000/svg}g' and node.attrib.get('fill') == '#000' and node.attrib.get('shape-rendering') == 'crispEdges':
        vector_barcode_rects += len(node.findall('s:rect', ns))
if vector_barcode_rects < 3:
    raise SystemExit(f'Expected vector barcode primitives; found {vector_barcode_rects}')
subprocess.run(['convert', '-background', 'white', '-density', str(dpi), str(svg_path), str(png_path)], check=True)
dimensions = subprocess.check_output(['identify', '-format', '%wx%h', str(png_path)], text=True)
actual_width, actual_height = (int(value) for value in dimensions.split('x'))
expected_width, expected_height = (round(width_mm * dpi / 25.4), round(height_mm * dpi / 25.4))
if abs(actual_width - expected_width) > 1 or abs(actual_height - expected_height) > 1:
    raise SystemExit(f'Raster geometry {dimensions} differs by more than one pixel from expected {expected_width}x{expected_height}')
print(f'PASS: Python XML parser accepted safe SVG; {vector_barcode_rects} vector barcode runs, {image_count} embedded PNG image(s); ImageMagick rasterized {dimensions} at {dpi} DPI (<=1 px physical-unit rounding).')
