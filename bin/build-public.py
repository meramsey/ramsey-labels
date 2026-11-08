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
    version=re.search(r'\* Version:\s*(\S+)',(ROOT/'public/src/ramsey-labels.php').read_text()).group(1).encode()
    if name not in ('ramsey-labels.php','LICENSE','THIRD_PARTY_NOTICES.md','assets/defaults.json'):
        value=value.replace(b"'ramsey-labels-independent'",b"'ramsey-labels'").replace(b'"ramsey-labels-independent"',b'"ramsey-labels"')
    if name=='readme.txt':
        value=value.replace(b'The in-place RC11 ZIP retains the RC8/RC9 basename ramsey-labels-independent/ramsey-labels-independent.php and saved option names. A separate prospective ramsey-labels directory ZIP has a tested, guarded migration path; do not keep both copies active. Back up first. On multisite, use Network Admin > Settings > Ramsey Labels job quarantine to explicitly dry-run, assign, and if necessary rollback legacy global jobs. The plugin never guesses a site owner.',b'The ramsey-labels directory package keeps the saved option keys and hooks from RC8/RC9. Back up first. If the legacy Ramsey Labels Independent folder is active, install this package, then deactivate the legacy plugin and reload. The public bootstrap refuses to load a second runtime while the legacy folder remains active. On multisite, use Network Admin > Settings > Ramsey Labels job quarantine to dry-run and explicitly assign each global legacy job only after the responsible site owner is confirmed. Rollback is available for unchanged site copies; ambiguous jobs remain quarantined until assigned.')
        value=re.sub(rb'^(Stable tag:) .*$',lambda match: match.group(1)+b' '+version,value,flags=re.M)
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
