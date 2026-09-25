'use strict';
// Executes only reviewed, isolated functions from the installed application.
// The application entrypoint is never evaluated and the live data directory is read-only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const REVIEWED = 'b58112eeca5fb0d2d93b0e4aeb1caf1d13bcd63d17533258eaeb66fa36c93016';
const ROOT = path.resolve(__dirname, '../..');
const FILES = ['rule_single.yaml', 'rule_multi.yaml', 'rule_special.yaml', 'rule_special_multi.yaml'];
const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function check(ok, message) { if (!ok) throw new Error(message); }

function loadClient(app = '/Applications/Clash Party.app') {
  const archive = fs.readFileSync(path.join(app, 'Contents/Resources/app.asar'));
  const header = JSON.parse(archive.subarray(16, 16 + archive.readUInt32LE(12)));
  function readArchive(name) {
    let entry = header;
    for (const part of name.split('/')) entry = entry?.files?.[part];
    check(entry && !entry.unpacked && entry.offset !== undefined, 'Missing packed application resource');
    const start = 8 + archive.readUInt32LE(4) + Number(entry.offset);
    check(Number.isSafeInteger(start) && start + entry.size <= archive.length, 'Invalid ASAR bounds');
    return archive.subarray(start, start + entry.size).toString('utf8');
  }
  const bundle = readArchive('out/main/index.js');
  check(sha256(bundle) === REVIEWED, 'Unreviewed application build; audit the source boundaries before updating this validator');
  const plist = fs.readFileSync(path.join(app, 'Contents/Info.plist'), 'utf8');
  check(/<key>CFBundleShortVersionString<\/key>\s*<string>2\.0\.3<\/string>/.test(plist), 'Expected reviewed Clash Party 2.0.3');

  const modules = new Map();
  const yamlContext = vm.createContext({ console: { warn() {} } }, { codeGeneration: { strings: false, wasm: false } });
  function yamlModule(name) {
    check(name.startsWith('node_modules/yaml/dist/') && name.endsWith('.js'), 'YAML dependency outside sandbox');
    if (modules.has(name)) return modules.get(name).exports;
    const module = { exports: {} };
    modules.set(name, module);
    const requireLocal = request => {
      if (request === 'process') return { env: {}, emitWarning() {}, stderr: { write() {} } };
      if (request === 'buffer') return { Buffer };
      check(request.startsWith('.'), 'Unexpected YAML dependency');
      return yamlModule(path.posix.normalize(path.posix.join(path.posix.dirname(name), request)));
    };
    new vm.Script('(function(module,exports,require){\n' + readArchive(name) + '\n})')
      .runInContext(yamlContext, { timeout: 5000 })(module, module.exports, requireLocal);
    return module.exports;
  }
  const yaml = yamlModule('node_modules/yaml/dist/index.js');
  const lines = bundle.split('\n');
  const slice = (first, last) => lines.slice(first - 1, last).join('\n');
  function freshContext() {
    const ctx = vm.createContext({ yaml, process: { platform: process.platform }, createHash: crypto.createHash },
      { codeGeneration: { strings: false, wasm: false } });
    // parse/stringify/deepMerge, constants and literal application defaults.
    vm.runInContext(slice(4541, 4809), ctx, { timeout: 5000 });
    vm.runInContext('this.defaults = { app: defaultConfig, controlled: defaultControledMihomoConfig };', ctx);
    return ctx;
  }
  const parser = freshContext();
  const parse = text => clone(vm.runInContext('parse(inputText)', Object.assign(parser, { inputText: text }), { timeout: 5000 }));
  const readYaml = file => parse(fs.readFileSync(file, 'utf8'));
  const defaults = clone(parser.defaults);

  function harness() {
    const ctx = freshContext();
    // DNS guard including its real post-apply persistence decision, with writes captured.
    vm.runInContext(slice(11834, 11920), ctx, { timeout: 5000 });
    vm.runInContext(slice(11960, 11988), ctx, { timeout: 5000 });
    // generateProfile, applyRuleOverride and actual override order/application.
    vm.runInContext(slice(12010, 12146), ctx, { timeout: 5000 });
    vm.runInContext(slice(12178, 12205), ctx, { timeout: 5000 });
    let input, output, savedWrites = [];
    const appState = clone(defaults.app);
    const controlledState = clone(defaults.controlled);
    controlledState.tun.enable = true; // The sole allowed difference from installation defaults.
    Object.assign(ctx, {
      getProfileConfig: async () => ({ current: 'synthetic' }),
      getAppConfig: async () => clone(appState),
      getProfileItem: async () => ({ override: input.bound ? ['rewrite'] : [] }),
      getProfile: async () => clone(input.base),
      globalOverrideIdsNow: async () => input.global ? ['rewrite'] : [],
      getControledMihomoConfig: async () => clone(controlledState),
      getOverrideItem: async () => ({ ext: 'yaml' }),
      getOverride: async () => input.text,
      decryptAgeContent: async text => text,
      rulePath: () => 'no-gui-rules', existsSync: () => false,
      ensureSmartProxyServerTunExclude: () => [], // Smart disabled by the audited defaults.
      atomicWriteFile: async (_file, text) => { output = text; },
      mihomoWorkConfigPath: () => 'memory-only',
      syncAppConfigAfterApply: async patch => { savedWrites.push(clone(patch)); Object.assign(appState, patch); },
      mainWindow: null, guardLogger: { info() {}, error() {} }, factoryLogger: { info() {}, error() {} }
    });
    const original = JSON.stringify({ appState, controlledState });
    return {
      async synthesize(base, text, { bound = true, global = false } = {}) {
        input = { base, text, bound, global };
        savedWrites = [];
        const result = await ctx.generateProfile(undefined, { outputPath: 'memory-only' });
        await ctx.syncControlDnsAfterApply(result.dnsGuard);
        assert.equal(JSON.stringify({ appState, controlledState }), original, 'Application settings changed');
        assert.deepEqual(savedWrites, [], 'DNS guard attempted to persist a setting');
        check(!result.dnsGuard.autoDisabled && !result.dnsGuard.request, 'Unexpected DNS guard intervention');
        return { config: parse(output), guard: clone(result.dnsGuard) };
      }
    };
  }
  return { yaml, parse, readYaml, defaults, harness, version: '2.0.3', fingerprint: REVIEWED,
    yamlVersion: JSON.parse(readArchive('node_modules/yaml/package.json')).version };
}

function inspectLocal(client, dir = path.join(os.homedir(), 'Library/Application Support/mihomo-party')) {
  const read = name => fs.existsSync(path.join(dir, name)) ? client.readYaml(path.join(dir, name)) : {};
  const app = { ...client.defaults.app, ...read('config.yaml') };
  const controlled = read('mihomo.yaml');
  const profiles = read('profile.yaml');
  const overrides = read('override.yaml');
  const current = profiles.items?.find(item => item.id === profiles.current);
  const safeId = id => { check(typeof id === 'string' && /^[\w-]+$/.test(id), 'Invalid local profile ID'); return id; };
  const subscription = current ? read(path.join('profiles', safeId(current.id) + '.yaml')) : null;
  return { subscription, summary: {
    appVersion: client.version, core: app.core,
    controlDns: app.controlDns, controlSniff: app.controlSniff, useNameserverPolicy: app.useNameserverPolicy,
    tunEnabled: controlled.tun?.enable ?? client.defaults.controlled.tun.enable,
    tunStack: controlled.tun?.stack ?? client.defaults.controlled.tun.stack,
    subscriptions: (profiles.items || []).length,
    boundOverrides: (current?.override || []).length,
    globalOverrides: (overrides.items || []).filter(item => item.global).length,
    nodeCount: subscription?.proxies?.length || 0,
    providerCount: Object.keys(subscription?.['proxy-providers'] || {}).length
  } };
}
module.exports = { loadClient, inspectLocal, ROOT, FILES, clone, sha256, check };
