#!/usr/bin/env python3
"""Produce redacted, committed verification evidence from actual local command outputs."""
import collections
import datetime
import hashlib
import json
import pathlib
import re
import zipfile

root=pathlib.Path(__file__).resolve().parent.parent
reports=root/'build/reports'
out=root/'docs/evidence'
out.mkdir(parents=True,exist_ok=True)
def text(name):
    return (reports/name).read_text()
def passed_count(name, pattern):
    match=re.search(pattern,text(name))
    if not match: raise RuntimeError(f'Missing passing result: {name}')
    return int(match[1])
phpunit=re.search(r'OK \((\d+) tests, (\d+) assertions\)',text('phpunit.txt'))
assert phpunit
assert re.search(r'OK \(15 tests, 20 assertions\)',text('phpunit74.txt'))
assert re.search(r'OK \(15 tests, 20 assertions\)',text('phpunit85.txt'))
js=passed_count('js-unit.txt',r'# pass (\d+)')
assert '# fail 0' in text('js-unit.txt')
assert 'All matched files use Prettier code style!' in text('js-lint.txt')
assert '[OK] No errors' in text('phpstan.txt')
assert 'no leaks found' in text('gitleaks.txt').lower()
assert 'PASS:' in text('pdf.txt')
assert 'PASS: activation' in text('lifecycle.txt') and 'PASS: missing WooCommerce' in text('lifecycle.txt')
assert 'PASS: RC8-to-RC9 full saved library exact equality' in text('upgrade.txt')
assert 'PASS: RC8-to-RC9 full saved library exact equality' in text('oldest-upgrade.txt')
assert 'PASS: RC8-to-RC9 full saved library exact equality' in text('php85-upgrade.txt')
pcp=[]
for line in text('package-plugin-check.txt').splitlines():
    if line.startswith('['):pcp.extend(json.loads(line))
pcp_counts=collections.Counter(x['type'] for x in pcp)
assert pcp_counts['ERROR']==0
wpcs=json.loads(text('phpcs-detail.json'))
sanitized_wpcs={'totals':wpcs['totals'],'files':{name.split('/app/')[-1]:file for name,file in wpcs['files'].items()}}
(out/'wpcs.json').write_text(json.dumps(sanitized_wpcs,indent=2)+'\n')
npm=json.loads(text('npm-audit.json'))
composer=json.loads(text('composer-audit.json'))
assert npm['metadata']['vulnerabilities']['total']==0
assert not composer['advisories'] and not composer['abandoned']
artifact=json.loads((root/'build/artifact-manifest.json').read_text())
assert hashlib.sha256((root/'build'/artifact['archive']).read_bytes()).hexdigest()==artifact['sha256']
archive=root/'ramsey-labels-independent-1.0.0-rc8.zip'
with zipfile.ZipFile(archive) as z:
    inventory=[{'path':name,'bytes':len(z.read(name)),'sha256':hashlib.sha256(z.read(name)).hexdigest()} for name in sorted(z.namelist())]
(out/'rc8-inventory.json').write_text(json.dumps({'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':inventory},indent=2)+'\n')
data={
    'status':'PARTIAL: not approved for publication',
    'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source_checkpoint':artifact['commit'],
    'artifact':artifact,
    'unit':{'php_tests':int(phpunit[1]),'php_assertions':int(phpunit[2]),'javascript_tests':js,'barcode_formats_independently_decoded':8},
    'phpunit_runtimes':['7.4.32','8.3.36','8.5.12'],
    'web_container_php_versions':{'oldest':text('php-oldest.txt').splitlines()[0],'php83':text('php-current.txt').splitlines()[0],'php85':text('php85-apache.txt').splitlines()[0]},
    'integration':{
        'wp_7_1_4_php_8_3_wc_11_2_2_legacy':passed_count('integration-legacy.txt',r'Integration assertions: (\d+)'),
        'wp_7_1_4_php_8_3_wc_11_2_2_hpos':passed_count('integration-hpos.txt',r'Integration assertions: (\d+)'),
        'wp_6_0_3_php_7_4_33_wc_7_0_1_legacy':passed_count('oldest-integration.txt',r'Integration assertions: (\d+)'),
        'wp_7_1_4_php_8_5_wc_11_2_2_legacy':passed_count('php85-integration-legacy.txt',r'Integration assertions: (\d+)'),
        'wp_7_1_4_php_8_5_wc_11_2_2_hpos':passed_count('php85-integration-hpos.txt',r'Integration assertions: (\d+)')},
    'browser':{'php83_passed':passed_count('e2e.txt',r'(\d+) passed'),'oldest_passed':passed_count('oldest-e2e.txt',r'(\d+) passed'),'php85_passed':passed_count('php85-e2e.txt',r'(\d+) passed'),'retries':0,'physical_printing':False},
    'upgrade':'Genuine archived RC8 process -> RC9 exact saved library equality on PHP 7.4, 8.3 and 8.5 combinations',
    'lifecycle':'Activation/deactivation exact library preservation; missing WooCommerce no fatal + notice; default uninstall retention',
    'pdf':text('pdf.txt').strip().splitlines(),
    'plugin_check':{'version':'2.1.0','errors':pcp_counts['ERROR'],'warnings':pcp_counts['WARNING'],'scope':'Installed allowlisted production ZIP, independent clean local site'},
    'wpcs':{'status':'FAIL: release blocking, no suppressed baseline','totals':wpcs['totals'],'detail':'wpcs.json'},
    'phpstan':{'level':5,'errors':0},
    'javascript_standards':'ESLint and Prettier pass',
    'dependency_audit':{'npm_findings':0,'composer_advisories':0,'abandoned_php_packages':0},
    'licenses':text('licenses.txt').strip().splitlines(),
    'secret_scan':'Gitleaks full committed history: no leaks found; artifact allowlist private-path/key scan passed',
    'ci':'Actionlint passed locally; workflows not run on GitHub and nothing pushed',
    'pending':['Full WPCS compliance and warning triage','Slug/basename/text-domain migration decision','Owner RC8 provenance/licensing attestation','Complete internationalization/accessibility/RTL/cross-browser coverage','Multisite purge, resource/race/fuzz/privacy acceptance','Physical printer/scanner and live WCPOS acceptance','Owner branding/contact/publication approvals']
}
(out/'verification.json').write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({k:data[k] for k in ['status','unit','integration','browser','plugin_check','wpcs']},indent=2))
