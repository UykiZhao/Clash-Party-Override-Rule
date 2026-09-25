#!/usr/bin/env node
'use strict';
// Kernel component tests: local synthetic HTTP proxies + local DNS + local origin.
// Deliberately constructs only group/rule components, never creates a TUN interface.
// Not an alternative acceptance scenario for the complete initialized client.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { loadClient, FILES, ROOT, clone, check, sha256 } = require('./lib/clash-party.cjs');
const { auditRemote } = require('./check-remote.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const serverSockets = new WeakMap();
async function listen(server) {
  const sockets = new Set();
  serverSockets.set(server, sockets);
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}
async function unusedPort() { const server = net.createServer(); const port = await listen(server); await new Promise(resolve => server.close(resolve)); return port; }
async function close(server) {
  // closeAllConnections does not include sockets upgraded by HTTP CONNECT.
  // Destroy owned fixture sockets so unfinished health checks cannot stall cleanup.
  const closed = new Promise(resolve => server.close(resolve));
  for (const socket of serverSockets.get(server) || []) socket.destroy();
  await closed;
}
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  check(['app', 'mihomo', 'cache-dir', 'proxy', 'report'].includes(key) && process.argv[i + 1], 'Unknown core test option');
  options[key] = process.argv[i + 1];
}
const core = options.mihomo || '/Applications/Clash Party.app/Contents/Resources/sidecar/mihomo';
const report = { date: '2026-09-25', scope: 'synthetic core components; no system TUN, real subscription, real AI/streaming or iOS tests', scenarios: [], business: [], lifecycle: [] };
report.testedAt = new Date().toISOString();
report.inputSha256 = Object.fromEntries([...FILES, 'scripts/validate-core.cjs'].map(f => [f, sha256(fs.readFileSync(path.join(ROOT, f)))]));
let temporary;
async function main() {
  const client = loadClient(options.app);
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'clash-core-components-'));
  fs.chmodSync(temporary, 0o700);
  const resources = options['cache-dir'] ? JSON.parse(fs.readFileSync(path.join(options['cache-dir'], 'index.json'), 'utf8')) :
    await auditRemote({ client, core, dir: path.join(temporary, 'remote'), proxy: options.proxy });
  const byURL = new Map(resources.map(r => [r.url, r]));
  const allNames = ['HK 01', 'TPE 01', 'JP 01', 'SG 01', 'US 01', 'US Residential', 'Australia 01', 'CMI 美国 02', 'Premium1 美国', 'VPS', '家宽', '剩余流量 100G'];
  const layouts = {
    synthetic: allNames, empty: [], 'provider-only': allNames,
    'mixed-providers': ['VPS', 'HK 01', 'US Residential'],
    'no-home': ['JP 01', 'US 01'], 'no-us': ['HK 01', 'JP 01'],
    unlabelled: ['VPS'], 'information-only': ['剩余流量 100G'],
    'preferred-down': ['HK 01', 'US Residential'], 'all-down': ['HK 01', 'US Residential']
  };
  for (const file of FILES) {
    const override = client.readYaml(path.join(ROOT, file));
    for (const [layout, names] of Object.entries(layouts)) {
      const dir = fs.mkdtempSync(path.join(temporary, 'case-'));
      let child, dns;
      const servers = [], reachable = new Map(names.map(n => [n, layout !== 'all-down' && !(layout === 'preferred-down' && n === 'US Residential')]));
      const mixed = await unusedPort(), controller = await unusedPort(), secret = crypto.randomBytes(20).toString('hex');
      let log = '';
      try {
        const nodes = [];
        for (const name of names) {
          const server = http.createServer((req, res) => {
            if (!reachable.get(name)) { req.socket.destroy(); return; }
            const health = req.url.includes('generate_204');
            setTimeout(() => { res.writeHead(204); res.end(); }, health ? 0 : 300);
          });
          // mihomo's HTTP outbound establishes a CONNECT tunnel even for plain HTTP.
          server.on('connect', (req, socket, head) => {
            if (!reachable.get(name)) { socket.destroy(); return; }
            socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            let request = '';
            const readRequest = data => {
              request += data.toString();
              if (!request.includes('\r\n\r\n')) return;
              socket.removeAllListeners('data');
              setTimeout(() => socket.end('HTTP/1.1 204 No Content\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'), request.includes('generate_204') ? 0 : 300);
            };
            socket.on('data', readRequest);
            if (head.length) readRequest(head);
            socket.on('error', () => {});
          });
          servers.push(server);
          nodes.push({ name, type: 'http', server: '127.0.0.1', port: await listen(server) });
        }
        const origin = http.createServer((req, res) => { setTimeout(() => { res.writeHead(204); res.end(); }, req.url === '/ready' ? 0 : 300); });
        servers.push(origin);
        const originPort = await listen(origin);
        // Minimal DNS responder. Resolution happens after route selection; no public DNS queries.
        dns = dgram.createSocket('udp4');
        dns.on('message', (query, peer) => {
          let end = 12;
          while (end < query.length && query[end]) end += query[end] + 1;
          end += 5;
          const question = query.subarray(12, end);
          const kind = query.readUInt16BE(end - 4);
          const header = Buffer.from(query.subarray(0, 12));
          header.writeUInt16BE(0x8180, 2); header.writeUInt16BE(kind === 1 ? 1 : 0, 6); header.writeUInt16BE(0, 8); header.writeUInt16BE(0, 10);
          const answer = kind === 1 ? Buffer.from([0xc0,0x0c,0,1,0,1,0,0,0,30,0,4,127,0,0,1]) : Buffer.alloc(0);
          dns.send(Buffer.concat([header, question, answer]), peer.port, peer.address);
        });
        await new Promise(resolve => dns.bind(0, '127.0.0.1', resolve));
        const cfg = { 'mixed-port': mixed, 'external-controller': '127.0.0.1:' + controller, secret,
          'allow-lan': false, mode: 'rule', ipv6: false, 'log-level': 'info', 'find-process-mode': 'off',
          profile: { 'store-selected': true },
          dns: { enable: true, 'enhanced-mode': 'redir-host', 'use-hosts': false, 'use-system-hosts': false,
            nameserver: ['127.0.0.1:' + dns.address().port], 'default-nameserver': ['127.0.0.1:' + dns.address().port] },
          proxies: nodes, 'proxy-groups': clone(override['proxy-groups']), rules: clone(override.rules),
          'proxy-providers': clone(override['proxy-providers']),
          'rule-providers': clone(override['rule-providers!']) };
        for (const provider of Object.values(cfg['rule-providers'])) {
          if (provider.type !== 'http') continue;
          const source = byURL.get(provider.url);
          check(source?.download === 'pass' && source?.format === 'pass' && fs.existsSync(source.filename), 'Missing audited public resource');
          provider.type = 'file';
          provider.path = './public/' + path.basename(source.filename);
          fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
          fs.copyFileSync(source.filename, path.join(dir, provider.path));
          delete provider.url; delete provider.interval;
        }
        if (layout === 'provider-only' || layout === 'mixed-providers') {
          cfg.proxies = layout === 'mixed-providers' ? nodes.slice(0, 1) : [];
          const parts = layout === 'mixed-providers' ? [nodes.slice(1, 2), nodes.slice(2)] : [nodes];
          parts.forEach((proxies, i) => {
            fs.writeFileSync(path.join(dir, `nodes-${i}.yaml`), client.yaml.stringify({ proxies }));
            cfg['proxy-providers']['source-' + i] = { type: 'file', path: `./nodes-${i}.yaml` };
          });
        }
        fs.writeFileSync(path.join(dir, 'config.yaml'), client.yaml.stringify(cfg), { mode: 0o600 });
        child = spawn(core, ['-d', dir, '-f', path.join(dir, 'config.yaml')], { stdio: ['ignore', 'pipe', 'pipe'] });
        const capture = data => { log = (log + data).slice(-250000); };
        child.stdout.on('data', capture); child.stderr.on('data', capture);
        async function api(endpoint, method = 'GET', body) {
          const response = await fetch('http://127.0.0.1:' + controller + endpoint, { method, headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000) });
          const text = await response.text();
          return { status: response.status, data: text ? JSON.parse(text) : null };
        }
        let started = false;
        for (let i = 0; i < 100; i++) {
          try { if ((await api('/version')).status === 200) { started = true; break; } } catch {}
          if (child.exitCode !== null) break;
          await wait(30);
        }
        check(started, 'Component kernel failed to start: ' + log.slice(-600));
        async function waitForDataPlane() {
          // /version and INNER health checks are available while ApplyConfig is still
          // loading rule providers. External TCP is rejected until tunnel.OnRunning().
          // A local private-IP request proves data-plane readiness without exercising AI
          // or changing any selection; the actual AI request below is still tested once.
          for (let i = 0; i < 120; i++) {
            const status = await new Promise(resolve => {
              const req = http.get({ host: '127.0.0.1', port: mixed, path: `http://127.0.0.1:${originPort}/ready`, headers: { Host: '127.0.0.1:' + originPort, Connection: 'close' } }, res => {
                res.resume(); res.on('end', () => resolve(res.statusCode));
              });
              req.setTimeout(1000, () => req.destroy()); req.on('error', () => resolve(0));
            });
            if (status === 204) return;
            await wait(25);
          }
          throw new Error('Component data plane never became ready');
        }
        await waitForDataPlane();
        async function state() { return (await api('/proxies')).data.proxies; }
        function terminal(proxies, name) {
          const seen = new Set(), chain = [];
          while (proxies[name]?.now) {
            check(!seen.has(name), 'Runtime group cycle'); seen.add(name); chain.push(name); name = proxies[name].now;
          }
          return { leaf: name, chain: chain.concat(name) };
        }
        const aiName = file.includes('special') ? '🤖 AI 解锁' : '🤖 AI 平台';
        const preferredGroup = file === 'rule_special_multi.yaml' ? '🇺🇸 美国-自动' : '🏠 家宽';
        const preferred = new RegExp(override['proxy-groups'].find(g => g.name === preferredGroup).filter.replace(/^\(\?i\)/, ''), 'i');
        let proxies = await state();
        // Let lazy=false's own startup health checks converge; never manually switch a group.
        const startup = Date.now();
        if (names.some(n => n !== '剩余流量 100G' && reachable.get(n))) {
          for (let i = 0; i < 120; i++) {
            const chosen = terminal(proxies, aiName).leaf;
            const needsPreference = names.some(n => reachable.get(n) && preferred.test(n));
            if (reachable.get(chosen) && (!needsPreference || preferred.test(chosen))) break;
            await wait(50); proxies = await state();
          }
        }
        const initial = terminal(proxies, aiName);
        const filtered = names.filter(n => n !== '剩余流量 100G');
        if (!filtered.length) assert.equal(initial.leaf, 'REJECT');
        else {
          assert(filtered.includes(initial.leaf), 'Initial path ends outside actual candidates');
          if (!['preferred-down', 'all-down'].includes(layout) && filtered.some(n => preferred.test(n))) assert(preferred.test(initial.leaf), 'Initial preferred region/home missing ' + JSON.stringify({ file, layout, initial, helper: proxies['🛟 AI 自动回退'] }));
        }
        for (const group of cfg['proxy-groups'].filter(g => g['include-all'])) {
          const actual = proxies[group.name].all;
          assert(!actual.includes('订阅排序占位（REJECT）'), 'Sort anchor exposed as a candidate');
          assert.equal(actual.length, new Set(actual).size, 'Target kernel candidate duplication');
          assert(!actual.includes('剩余流量 100G'), 'Information node in target kernel group');
          if (group.name.includes('美国')) assert(!actual.includes('Australia 01'), 'Australia misclassified by target kernel');
          if (group.name.includes('香港') || group.name.includes('新加坡')) {
            assert(!actual.includes('CMI 美国 02') && !actual.includes('Premium1 美国'), 'Operator misclassified by target kernel');
          }
          if (group.name === '🚀 节点选择' && names.includes('VPS')) assert(actual.includes('VPS'), 'Unlabelled node lost');
        }
        // Use the configured URL so the core records the same health state the fallback reads.
        const health = await api('/group/' + encodeURIComponent('🛟 AI 自动回退') + '/delay?url=' + encodeURIComponent('http://www.gstatic.com/generate_204') + '&timeout=1000');
        check([200, 503, 504].includes(health.status), 'Unexpected target core group health-check API response ' + health.status);
        proxies = await state();
        const after = terminal(proxies, aiName);
        assert.notEqual(after.leaf, 'DIRECT', 'Automatic fallback leaked to DIRECT');
        if (filtered.some(n => reachable.get(n))) {
          assert(reachable.get(after.leaf), 'Fallback failed to choose a reachable synthetic node');
          if (filtered.some(n => reachable.get(n) && preferred.test(n))) assert(preferred.test(after.leaf), 'Reachable preferred candidate ignored');
        }
        const result = { file, layout, status: 'pass', startupConvergenceMs: Date.now() - startup, initial: initial.chain, afterHealth: after.chain, healthyCandidates: filtered.filter(n => reachable.get(n)).length };
        if (layout === 'preferred-down') {
          reachable.set('US Residential', true);
          await api('/group/' + encodeURIComponent('🛟 AI 自动回退') + '/delay?url=' + encodeURIComponent('http://www.gstatic.com/generate_204') + '&timeout=1000');
          result.recovered = terminal(await state(), aiName).chain;
          assert.equal(result.recovered[result.recovered.length - 1], 'US Residential');
        }
        result.forwarding = await new Promise(resolve => {
          const req = http.get({ host: '127.0.0.1', port: mixed, path: `http://chatgpt.com:${originPort}/probe`, headers: { Host: 'chatgpt.com:' + originPort, Connection: 'close' } }, res => {
            let body = '';
            res.on('data', data => { body = (body + data).slice(0, 500); });
            res.on('end', () => { if (res.statusCode !== 204) result.failureDetail = { body, server: res.headers.server }; resolve(res.statusCode); });
          });
          req.setTimeout(4000, () => req.destroy());
          req.on('error', () => resolve('failed'));
        });
        if (filtered.some(n => reachable.get(n))) assert.equal(result.forwarding, 204, 'Default AI chain cannot actually forward synthetic HTTP ' + JSON.stringify({ file, layout, initial: result.initial, afterHealth: result.afterHealth, failure: result.failureDetail, log: log.slice(-4000) }));
        else assert.notEqual(result.forwarding, 204, 'Empty/dead subscription reported success');
        report.scenarios.push(result);
        if (layout === 'provider-only') {
          const remaining = nodes.filter(n => !preferred.test(n.name));
          fs.writeFileSync(path.join(dir, 'nodes-0.yaml'), client.yaml.stringify({ proxies: remaining }));
          check((await api('/providers/proxies/source-0', 'PUT')).status === 204, 'File provider update failed');
          const removed = terminal(await state(), aiName);
          assert(!preferred.test(removed.leaf) && reachable.get(removed.leaf), 'Provider removal did not refresh default fallback');
          fs.writeFileSync(path.join(dir, 'nodes-0.yaml'), client.yaml.stringify({ proxies: nodes }));
          check((await api('/providers/proxies/source-0', 'PUT')).status === 204, 'File provider restore failed');
          const restored = terminal(await state(), aiName);
          assert(preferred.test(restored.leaf), 'Provider addition did not restore preference');
          report.lifecycle.push({ file, check: 'provider remove/add preferred candidates', status: 'pass', removed: removed.chain, restored: restored.chain });
        }
        if (layout === 'synthetic') {
          const special = file.includes('special'), ai = special ? '🤖 AI 解锁' : '🤖 AI 平台', direct = '🎯 全球直连';
          const tests = [
            ['baidu.com', direct], ['bilibili.com', direct], ['alipay.com', direct], ['deepseek.com', direct], ['badjs.weixinbridge.com', direct],
            ['chatgpt.com', ai], ['claude.ai', ai], ['aistudio.google.com', ai], ['notebooklm.google.com', ai],
            ['notebook.google.com', ai], ['notebook.google', ai],
            ['stun.l.google.com', ai], ['stun1.l.google.com', ai], ['stun.cloudflare.com', ai],
            ['gemini.google.com', special ? direct : ai], ['openrouter.ai', ai], ['grok.com', special ? '🧪 AI 备选' : ai],
            ['google.com', special ? direct : '🚀 节点选择'], ['github.com', special ? direct : '🚀 节点选择'],
            ['netflix.com', special ? direct : '🎬 流媒体解锁'], ['hulu.com', '🎬 流媒体解锁'], ['peacocktv.com', '🎬 流媒体解锁'],
            ['bbc.co.uk', special ? '🎬 流媒体解锁' : '🚀 节点选择'], ['bbc.com', special ? direct : '🚀 节点选择'],
            ['sciencedirect.com', special ? direct : '🚀 节点选择'], ['otel.cline.bot', '🛑 广告拦截'],
            ['search.agonygao.top', special ? ai : 'BASELINE'], ['luckyg.131518.xyz', special ? ai : 'BASELINE'],
            ['rewrite-unmatched-20260925.codexunmatched', special ? direct : '🐟 漏网之鱼']
          ];
          for (const [domain, expected] of tests) {
            const logStart = log.length;
            let finished = false;
            const outcome = new Promise(resolve => {
              const req = http.request({ host: '127.0.0.1', port: mixed, path: `http://${domain}:${originPort}/probe`, method: 'GET', headers: { Host: domain + ':' + originPort, Connection: 'close' } }, res => {
                res.resume(); res.on('end', () => { finished = true; resolve({ status: res.statusCode }); });
              });
              req.setTimeout(4000, () => req.destroy());
              req.on('error', () => { finished = true; resolve({ status: 'rejected-or-unreachable' }); }); req.end();
            });
            let connection;
            for (let i = 0; i < 80; i++) {
              const connections = (await api('/connections')).data.connections || [];
              connection = connections.find(conn => conn.metadata?.host === domain);
              if (connection || finished) break;
              await wait(10);
            }
            const httpResult = await outcome;
            const evidence = log.slice(logStart).split('\n').find(line => line.includes(domain + ':') && line.includes('match '));
            let group;
            if (connection) group = [...connection.chains].reverse().find(n => cfg['proxy-groups'].some(g => g.name === n));
            if (!group && evidence) group = cfg['proxy-groups'].find(g => evidence.includes('using ' + g.name + '['))?.name;
            if (expected !== 'BASELINE') assert.equal(group, expected, 'Unexpected first match for ' + domain);
            check(group, 'Missing route evidence for ' + domain);
            const selected = terminal(await state(), group);
            if (selected.leaf === 'REJECT') assert.notEqual(httpResult.status, 204, 'Rejected sample unexpectedly forwarded');
            else assert.equal(httpResult.status, 204, 'Synthetic local transport failed for ' + domain);
            report.business.push({ file, domain, status: 'pass', rule: connection?.rule || evidence?.match(/match (.+?) using/)?.[1],
              payload: connection?.rulePayload, group, current: selected.chain, final: selected.leaf,
              syntheticHTTP: httpResult.status, realServiceAccess: 'not-run' });
          }
          // A saved optional user choice must survive a core reload and clean restart.
          const stream = '/proxies/' + encodeURIComponent('🎬 流媒体解锁');
          check((await api(stream, 'PUT', { name: 'DIRECT' })).status === 204, 'Cannot set synthetic optional selection');
          check((await api('/configs?force=true', 'PUT', { path: path.join(dir, 'config.yaml') })).status === 204, 'Component reload failed');
          assert.equal((await state())['🎬 流媒体解锁'].now, 'DIRECT', 'Selection lost on reload');
          child.kill('SIGTERM');
          await new Promise(resolve => child.once('close', resolve));
          child = spawn(core, ['-d', dir, '-f', path.join(dir, 'config.yaml')], { stdio: ['ignore', 'pipe', 'pipe'] });
          child.stdout.on('data', capture); child.stderr.on('data', capture);
          let restarted = false;
          for (let i = 0; i < 100; i++) {
            try { if ((await api('/version')).status === 200) { restarted = true; break; } } catch {}
            await wait(30);
          }
          check(restarted, 'Component restart failed');
          await waitForDataPlane();
          assert.equal((await state())['🎬 流媒体解锁'].now, 'DIRECT', 'Selection lost on restart');
          assert.equal(Object.keys((await api('/providers/rules')).data.providers).length, Object.keys(cfg['rule-providers']).length, 'Provider count drift on restart');
          report.lifecycle.push({ file, check: 'core reload/restart preserves optional choice, rule providers and default AI path', status: 'pass', ai: terminal(await state(), aiName).chain });
        }
      } finally {
        if (child && child.exitCode === null) {
          child.kill('SIGTERM');
          await Promise.race([new Promise(resolve => child.once('close', resolve)), wait(2000)]);
          if (child.exitCode === null) child.kill('SIGKILL');
        }
        if (dns) dns.close();
        for (const server of servers) await close(server);
      }
    }
    console.log('PASS target-kernel candidates, preference/failure/recovery and 29 routing samples: ' + file);
  }
  report.status = 'pass';
  console.log(`PASS ${report.scenarios.length} component scenarios and ${report.business.length} synthetic routing checks; real TUN/service acceptance not run`);
}
main().catch(error => { report.status = 'fail'; report.error = error.message; console.error('FAIL ' + error.message); process.exitCode = 1; }).finally(() => {
  if (options.report) fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
});
