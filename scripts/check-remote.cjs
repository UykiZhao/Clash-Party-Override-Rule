#!/usr/bin/env node
'use strict';
// Public remote resources only. Download success, format validity and local/raw equality are separate.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { loadClient, FILES, ROOT, sha256, check } = require('./lib/clash-party.cjs');
const lines = text => text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#') && !s.startsWith('//'));
function command(file, args, timeout = 65000) {
  return new Promise(resolve => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const capture = data => { output = (output + data).slice(-2000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, output: 'Command unavailable' }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output }); });
  });
}
async function auditRemote({ client, core, dir, proxy }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sources = new Map();
  const add = (url, ref) => {
    const parsed = new URL(url);
    check(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'Only public HTTPS sources allowed');
    if (!sources.has(url)) sources.set(url, { url, refs: [] });
    sources.get(url).refs.push(ref);
  };
  for (const file of FILES) {
    const cfg = client.readYaml(path.join(ROOT, file));
    for (const [name, p] of Object.entries(cfg['rule-providers!'])) if (p.type === 'http') add(p.url, { file, name, behavior: p.behavior, format: p.format });
  }
  for (const file of ['shadowrocket.conf', 'shadowrocket_special.conf']) {
    for (const line of lines(fs.readFileSync(path.join(ROOT, file), 'utf8'))) {
      const p = line.split(',');
      if (['RULE-SET', 'DOMAIN-SET'].includes(p[0])) add(p[1], { file, format: p[0] });
    }
  }
  const entries = [...sources.values()];
  let index = 0;
  async function worker() {
    while (index < entries.length) {
      const item = entries[index++];
      const filename = path.join(dir, sha256(item.url));
      const args = ['--fail', '--silent', '--show-error', '--location', '--connect-timeout', '10', '--max-time', '30', '--retry', '1', '--retry-max-time', '45'];
      if (proxy) args.push('--proxy', proxy);
      args.push('--output', filename, item.url);
      const fetched = await command('curl', args);
      item.download = fetched.code === 0 ? 'pass' : 'fail';
      if (fetched.code !== 0) { item.reason = fetched.output.replace(/\n/g, ' ').slice(0, 200); continue; }
      const data = fs.readFileSync(filename);
      item.bytes = data.length; item.sha256 = sha256(data);
      item.filename = filename; // Removed from the public report, used only by component tests.
      const ref = item.refs[0];
      try {
        if (ref.format === 'mrs') {
          const target = filename + '.txt';
          const result = await command(core, ['convert-ruleset', ref.behavior, 'mrs', filename, target], 10000);
          check(result.code === 0 && fs.existsSync(target), 'Target kernel rejected MRS behavior/format');
          item.entries = lines(fs.readFileSync(target, 'utf8')).length;
          item.decoded = target;
        } else {
          const content = data.toString('utf8');
          check(!/<(?:html|!DOCTYPE)/i.test(content), 'HTML instead of a ruleset');
          const rules = lines(content);
          check(rules.length > 0, 'Empty ruleset');
          if (ref.format === 'RULE-SET') {
            check(rules.every(s => /^(?:DOMAIN(?:-SUFFIX|-KEYWORD|-WILDCARD|-REGEX)?|IP-CIDR6?|IP-ASN|GEOIP|USER-AGENT|URL-REGEX|PROCESS-NAME|AND|OR|NOT),/.test(s)), 'Unsupported RULE-SET line');
          } else {
            check(rules.every(s => !s.includes(',') && !/\s/.test(s)), 'Expected a domain-only file');
          }
          item.entries = rules.length;
          if (item.url.includes('/UykiZhao/Clash-Party-Override-Rule/')) {
            const local = lines(fs.readFileSync(path.join(ROOT, 'rules/shadowrocket', path.basename(new URL(item.url).pathname)), 'utf8'));
            item.localRawRuleEquality = JSON.stringify(local) === JSON.stringify(rules) ? 'pass' : 'fail';
            item.localRawBytesEqual = sha256(data) === sha256(fs.readFileSync(path.join(ROOT, 'rules/shadowrocket', path.basename(new URL(item.url).pathname))));
          }
        }
        check(item.entries > 0, 'No decoded entries');
        item.format = 'pass';
      } catch (error) { item.format = 'fail'; item.reason = error.message; }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return entries;
}
async function main() {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i].replace(/^--/, '');
    check(['app', 'mihomo', 'proxy', 'cache-dir', 'report'].includes(k) && process.argv[i + 1], 'Unknown remote-check option');
    options[k] = process.argv[i + 1];
  }
  const dir = options['cache-dir'] || fs.mkdtempSync(path.join(os.tmpdir(), 'clash-public-rules-'));
  try {
    const sources = await auditRemote({ client: loadClient(options.app), core: options.mihomo || '/Applications/Clash Party.app/Contents/Resources/sidecar/mihomo', dir, proxy: options.proxy });
    const publicSources = sources.map(({ filename, decoded, ...s }) => s);
    const failed = sources.filter(s => s.download !== 'pass' || s.format !== 'pass' || s.localRawRuleEquality === 'fail');
    for (const s of failed) console.log('FAIL ' + s.url + ': ' + s.reason);
    console.log(`${sources.length - failed.length}/${sources.length} remote resources downloaded and format checked; transport=${options.proxy ? 'explicit local proxy' : 'host network'}`);
    if (options.report) fs.writeFileSync(options.report, JSON.stringify({ date: '2026-09-25', transport: options.proxy ? 'explicit local proxy (existing client)' : 'host network', sources: publicSources }, null, 2) + '\n');
    if (options['cache-dir']) fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(sources, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally { if (!options['cache-dir']) fs.rmSync(dir, { recursive: true, force: true }); }
}
module.exports = { auditRemote, lines, command };
if (require.main === module) main().catch(error => { console.error('FAIL ' + error.message); process.exitCode = 1; });
