#!/usr/bin/env node
'use strict';
// Actual reviewed client generation in an isolated VM. No live reload, TUN creation or app writes.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { loadClient, inspectLocal, ROOT, FILES, clone, sha256, check } = require('./lib/clash-party.cjs');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i].replace(/^--/, '');
  check(['app', 'client-data', 'mihomo', 'report'].includes(name) && process.argv[i + 1], 'Unknown or incomplete option');
  options[name] = path.resolve(process.argv[i + 1]);
}
let temporary;
const report = { date: '2026-09-25', scope: 'isolated actual client generation; core -t never starts TUN', cases: [], limitations: [] };
report.testedAt = new Date().toISOString();
report.inputSha256 = Object.fromEntries([...FILES, 'scripts/validate-client.cjs', 'scripts/lib/clash-party.cjs'].map(f => [f, sha256(fs.readFileSync(path.join(ROOT, f)))]));
function run(executable, args, timeout = 90000) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const capture = data => { output = (output + data).slice(-32768); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, output: '' }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output }); });
  });
}
function snapshot(dir) {
  return Object.fromEntries(['config.yaml', 'mihomo.yaml', 'profile.yaml', 'override.yaml'].map(name => {
    const file = path.join(dir, name);
    return [name, fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null];
  }));
}
function diffPaths(a, b, prefix = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return [prefix];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => diffPaths(a[key], b[key], prefix ? prefix + '.' + key : key));
}
async function main() {
  const client = loadClient(options.app);
  const localDir = options['client-data'] || path.join(os.homedir(), 'Library/Application Support/mihomo-party');
  const before = snapshot(localDir);
  const local = inspectLocal(client, localDir);
  report.client = { version: client.version, bundleSha256: client.fingerprint, yaml: client.yamlVersion };
  report.initial = { controlDns: client.defaults.app.controlDns, controlSniff: client.defaults.app.controlSniff,
    useNameserverPolicy: client.defaults.app.useNameserverPolicy, tun: true };
  report.observed = local.summary;
  const observedBaselineMatches = local.summary.controlDns === report.initial.controlDns && local.summary.controlSniff === report.initial.controlSniff &&
    local.summary.useNameserverPolicy === report.initial.useNameserverPolicy && local.summary.tunEnabled === true;
  report.observedBaseline = observedBaselineMatches ? 'pass' : 'fail';
  console.log(`Clash Party ${client.version}; bundled YAML ${client.yamlVersion}; real guard, merge, override order and generator`);
  console.log(`${observedBaselineMatches ? 'PASS' : 'FAIL'} observed baseline: DNS override=${local.summary.controlDns}, sniff override=${local.summary.controlSniff}, DNS policy=${local.summary.useNameserverPolicy}, TUN=${local.summary.tunEnabled}`);
  if (!observedBaselineMatches) console.log('Continue independent tests against audited installation defaults; current client is not claimed to satisfy the baseline, no settings will be changed');
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'clash-rewrite-client-'));
  fs.chmodSync(temporary, 0o700);
  const node = name => ({ name, type: 'socks5', server: '127.0.0.1', port: 9 });
  const names = ['HK 01', 'TPE 01', 'JP 01', 'SG 01', 'US 01', 'US Residential', 'Australia 01', 'CMI 美国 02', 'Premium1 美国', 'VPS', '家宽', '剩余流量 100G'];
  const provider = (filename, ns) => {
    fs.writeFileSync(path.join(temporary, filename), client.yaml.stringify({ proxies: ns.map(node) }), { mode: 0o600 });
    return { type: 'file', path: './' + filename };
  };
  const layouts = {
    synthetic: { proxies: names.map(node) },
    empty: { proxies: [] },
    'provider-only': { proxies: [], 'proxy-providers': { sample: provider('nodes.yaml', names) } },
    'mixed-providers': { proxies: [node('VPS')], 'proxy-providers': { a: provider('a.yaml', ['HK 01']), z: provider('z.yaml', ['US Residential']) } },
    'no-home': { proxies: ['US 01', 'JP 01'].map(node) },
    'no-us': { proxies: ['JP 01', 'HK 01'].map(node) },
    unlabelled: { proxies: [node('VPS')] },
    'information-only': { proxies: [node('剩余流量 100G')] }
  };
  const dnsInputs = {
    absent: {},
    supplied: { dns: { enable: true, nameserver: ['192.0.2.53'] } },
    policy: { dns: { enable: true, 'proxy-server-nameserver': ['192.0.2.54'], 'nameserver-policy': { '+.example.invalid': '192.0.2.55' } } }
  };
  if (options.mihomo) {
    const v = await run(options.mihomo, ['-v']);
    check(v.code === 0, 'Cannot execute target kernel');
    report.kernel = v.output.split('\n')[0];
    console.log(report.kernel);
    // Synthetic proxies intentionally cannot download GeoSite. Fetch a fresh public copy
    // independently; this is a parser prerequisite, not evidence of cold core bootstrap.
    const url = client.defaults.controlled['geox-url'].geosite;
    const downloaded = await run('curl', ['--fail', '--silent', '--show-error', '--location',
      '--connect-timeout', '10', '--max-time', '60', '--output', path.join(temporary, 'geosite.dat'), url], 65000);
    check(downloaded.code === 0, 'Fresh public GeoSite download failed');
    report.geodata = { source: url, sha256: sha256(fs.readFileSync(path.join(temporary, 'geosite.dat'))),
      method: 'independent curl download; not native core bootstrap, no client cache copied' };
    console.log('Fresh public GeoSite fetched independently; native core cold bootstrap remains a separate check');
  }
  let merged = 0, loaded = 0;
  for (const file of FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const override = client.parse(text);
    for (const [layout, nodes] of Object.entries(layouts)) {
      for (const [dnsCase, dns] of Object.entries(dnsInputs)) {
        const base = { ...clone(nodes), ...clone(dns), 'proxy-groups': [{ name: 'obsolete', type: 'select', proxies: ['DIRECT'] }], rules: ['MATCH,DIRECT'] };
        const harness = client.harness();
        const first = await harness.synthesize(base, text);
        assert.deepEqual(first.config.dns, override['dns!'], 'DNS not self contained');
        assert.deepEqual(first.config.rules, override.rules, 'Route replacement failed');
        assert.deepEqual(first.config['proxy-groups'], override['proxy-groups'], 'Group replacement failed');
        assert.deepEqual(first.config.proxies, nodes.proxies, 'Subscription nodes changed');
        assert.deepEqual(first.config['proxy-providers'], { ...(nodes['proxy-providers'] || {}), ...override['proxy-providers'] }, 'Subscription provider changed');
        assert.equal(first.config.tun.enable, true);
        assert.deepEqual(first.config.tun['dns-hijack'], client.defaults.controlled.tun['dns-hijack']);
        assert.equal(first.config.dns['fake-ip-filter'].includes('*'), false);
        for (const [cycle, scope] of [['subscription-update', {}], ['override-update', { global: true }], ['global-only', { bound: false, global: true }]]) {
          const next = await harness.synthesize(base, text, scope);
          assert.deepEqual(next.config, first.config, 'Generation drift on ' + cycle);
          merged++;
        }
        const restart = await client.harness().synthesize(base, text);
        assert.deepEqual(restart.config, first.config, 'Restart depends on guard memory');
        merged += 2; // first load + fresh-context restart
        if (options.mihomo && dnsCase === 'policy') {
          const cfgPath = path.join(temporary, 'config.yaml');
          fs.writeFileSync(cfgPath, client.yaml.stringify(first.config), { mode: 0o600 });
          const result = await run(options.mihomo, ['-t', '-d', temporary, '-f', cfgPath]);
          const status = result.code === 0 ? 'pass' : 'fail';
          report.cases.push({ file, layout, dnsCase, status, check: 'complete synthesized config -t' });
          if (result.code !== 0) {
            // Synthetic input contains no secrets. Keep only the error line, not a whole generated config.
            const error = result.output.split('\n').filter(line => /error|fatal|panic|failed/i.test(line)).slice(-2).join(' ').slice(0, 500);
            throw new Error('Kernel rejected ' + file + ' / ' + layout + ': ' + error);
          }
          loaded++;
        }
      }
    }
    const sample = (await client.harness().synthesize({ proxies: [node('VPS')] }, text)).config;
    const fields = Object.fromEntries(Object.entries(override).filter(([key]) => key !== 'proxy-groups' && key !== 'rules' && key !== 'rule-providers!').map(([key, value]) => [key.replace(/!$/, ''), value]));
    const effective = Object.fromEntries(Object.keys(fields).map(key => [key, sample[key]]));
    report.cases.push({ file, check: 'application-default overrides', paths: diffPaths(fields, effective), status: 'pass',
      effective: { ipv6: sample.ipv6, tcpConcurrent: sample['tcp-concurrent'], tun: sample.tun,
        sniffer: sample.sniffer, geoAutoUpdate: sample['geo-auto-update'], geodataMode: sample['geodata-mode'], geox: sample['geox-url'] } });
    console.log('PASS actual generation/lifecycle + application options unchanged: ' + file);
  }
  if (options.mihomo && local.subscription) {
    // Validate the whole current subscription, not a hard-coded provider name or a credentials-only extract.
    // No subscription data or connection logs are included in the report.
    for (const file of FILES) {
      const result = await client.harness().synthesize(local.subscription, fs.readFileSync(path.join(ROOT, file), 'utf8'));
      const cfgPath = path.join(temporary, 'local.yaml');
      fs.writeFileSync(cfgPath, client.yaml.stringify(result.config), { mode: 0o600 });
      const tested = await run(options.mihomo, ['-t', '-d', temporary, '-f', cfgPath]);
      report.cases.push({ file, check: 'whole current subscription -t', status: tested.code === 0 ? 'pass' : 'fail' });
      check(tested.code === 0, 'Whole subscription kernel check failed; details withheld to protect connection data');
      loaded++;
    }
    console.log('PASS four whole-current-subscription kernel checks (private temporary files only)');
  }
  assert.deepEqual(snapshot(localDir), before, 'Live client files changed during validation');
  report.mergeChecks = merged;
  report.kernelChecks = loaded;
  report.liveSettingsUnchanged = true;
  report.limitations = [
    'No GUI import, reload, subscription download, live TUN route or service-account test.',
    'Lifecycle checks run actual generation repeatedly; they do not restart the desktop application.',
    'The default sniff override replaces Mijia skip-domain and HTTP/TLS ports; QUIC remains.',
    'The application also overrides Geo URLs/update switch, IPv6 and TCP concurrency; source fields are not locks.',
    'No iOS device test; remote rule verification and synthetic core component tests are separate.'
  ];
  console.log(`PASS ${merged} actual generation checks; ${loaded} kernel -t checks; no client option writes`);
  report.isolatedChecks = 'pass';
  report.status = observedBaselineMatches ? 'pass' : 'fail';
  if (!observedBaselineMatches) process.exitCode = 1;
}
main().catch(error => { report.status = 'fail'; console.error('FAIL ' + error.message); process.exitCode = 1; }).finally(() => {
  if (options.report) fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
});
