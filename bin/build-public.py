#!/usr/bin/env python3
"""Build a distinct WordPress.org slug package; never replace the legacy RC ZIP."""
import hashlib,json,pathlib,re,subprocess,zipfile
from build import ROOT,MANIFEST

SLUG='ramsey-labels'
PUBLIC_MANIFEST=[name for name in MANIFEST if name!='ramsey-labels-independent.php']+['ramsey-labels.php']
PUBLIC_MANIFEST=[name for name in PUBLIC_MANIFEST if name!='languages/ramsey-labels-independent.pot']+['languages/ramsey-labels.pot']

def content(name):
    original='languages/ramsey-labels-independent.pot' if name=='languages/ramsey-labels.pot' else ('public/src/ramsey-labels.php' if name=='ramsey-labels.php' else name)
    value=(ROOT/original).read_bytes()
    if name not in ('ramsey-labels.php','LICENSE','THIRD_PARTY_NOTICES.md','assets/defaults.json'):
        value=value.replace(b"'ramsey-labels-independent'",b"'ramsey-labels'").replace(b'"ramsey-labels-independent"',b'"ramsey-labels"')
    if name=='readme.txt':
        value=value.replace(b'For RC8 upgrades, retain ramsey-labels-independent/ramsey-labels-independent.php. Do not install a second copy under a new folder. Saved option names and hooks are unchanged. Read docs/migration.md before changing the public slug.',b'Upgrade safely: back up the site. If Ramsey Labels Independent is active, install and activate this plugin first; it will remain paused and display a migration notice. Deactivate Ramsey Labels Independent, then reload the administration page. The new directory becomes active using the same saved options, single-site job data, and extension hooks. To roll back, deactivate this plugin and reactivate the legacy plugin. Do not keep both runtime copies active. On multisite, legacy global job records require explicit network-owner reassignment before they are exposed in a site-scoped account.')
        value=re.sub(rb'^(Stable tag:) .*$',b'\\1 1.0.0-rc.10',value,flags=re.M)
    if name=='languages/ramsey-labels.pot':
        value=value.replace(b'ramsey-labels-independent',b'ramsey-labels')
        migration=(b'\n#: ramsey-labels.php\nmsgid "Ramsey Labels is paused because the legacy Ramsey Labels Independent folder is still active. Saved settings are preserved. Deactivate the legacy folder; the directory installation will then start automatically."\nmsgstr ""\n')
        value+=migration
        value=value.replace(b'ramsey-labels.php',b'ramsey-labels.php')
    return value

def main():
    directory=ROOT/'build/public';directory.mkdir(parents=True,exist_ok=True)
    version=re.search(r'\* Version:\s*(\S+)',(ROOT/'public/src/ramsey-labels.php').read_text()).group(1)
    header=(ROOT/'public/src/ramsey-labels.php').read_text()
    if f' * Text Domain: {SLUG}' not in header or f'Stable tag: {version}' not in (ROOT/'readme.txt').read_text():
        raise SystemExit('Public plugin/readme slug, domain or version metadata is inconsistent')
    target=directory/f'{SLUG}-{version}.zip';file_hashes={}
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name in sorted(PUBLIC_MANIFEST):
            data=content(name)
            if b'ramsey-labels-independent' in data and name not in ('readme.txt','ramsey-labels.php'):
                raise ValueError('Legacy text-domain/identity leaked into public package: '+name)
            info=zipfile.ZipInfo(f'{SLUG}/{name}',(2020,1,1,0,0,0));info.create_system=3;info.external_attr=0o100644<<16;info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,data,compresslevel=9);file_hashes[name]=hashlib.sha256(data).hexdigest()
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert sorted(archive.namelist())==sorted(f'{SLUG}/{name}' for name in PUBLIC_MANIFEST)
        assert f'{SLUG}/ramsey-labels.php' in archive.namelist()
        assert f'{SLUG}/ramsey-labels-independent.php' not in archive.namelist()
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix('.zip.sha256').write_text(f'{digest}  {target.name}\n')
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    (directory/'artifact-manifest.json').write_text(json.dumps({'slug':SLUG,'version':version,'commit':commit,'archive':target.name,'sha256':digest,'files':file_hashes},indent=2)+'\n')
    print(f'{target.relative_to(ROOT)}\nSHA-256 {digest}\n{len(file_hashes)} allowlisted files; install basename {SLUG}/ramsey-labels.php')

if __name__=='__main__':main()
