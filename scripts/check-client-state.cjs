#!/usr/bin/env node
'use strict';
// Read the initialized client state without changing switches, nodes or bindings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loadClient, inspectLocal, sha256, check } = require('./lib/clash-party.cjs');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  check(['app', 'client-data'].includes(key) && process.argv[i + 1], 'Unknown state-check option');
  options[key] = process.argv[i + 1];
}
try {
  const client = loadClient(options.app);
  const dir = options['client-data'] || path.join(os.homedir(), 'Library/Application Support/mihomo-party');
  const files = ['config.yaml', 'mihomo.yaml', 'profile.yaml', 'override.yaml'];
  const hashes = () => files.map(name => fs.existsSync(path.join(dir, name)) ? sha256(fs.readFileSync(path.join(dir, name))) : null);
  const before = hashes(), local = inspectLocal(client, dir), state = local.summary;
  console.log('Read-only Clash Party ' + state.appVersion + ' configuration inspection; no network probe or live reload');
  for (const key of ['controlDns', 'controlSniff', 'useNameserverPolicy']) {
    const match = state[key] === client.defaults.app[key];
    console.log((match ? 'PASS ' : 'FAIL ') + key + ' matches installed initialization default: ' + state[key]);
    if (!match) process.exitCode = 1;
  }
  console.log((state.tunEnabled ? 'PASS ' : 'FAIL ') + 'saved TUN enable=' + state.tunEnabled);
  if (!state.tunEnabled) process.exitCode = 1;
  const saved = client.readYaml(path.join(dir, 'mihomo.yaml'));
  assert.deepEqual(saved.tun, { ...client.defaults.controlled.tun, enable: true }, 'Saved TUN advanced options differ from initialization defaults');
  console.log('PASS saved TUN advanced options remain at initialization defaults');
  console.log('Subscription overrides=' + state.boundOverrides + '; global overrides=' + state.globalOverrides);
  if (state.boundOverrides + state.globalOverrides === 0) console.log('NOT RUN rewrite runtime acceptance: no override is bound (the requested pre-import baseline)');
  else console.log('NOT RUN rewrite runtime acceptance: bindings alone do not prove the loaded rules or traffic path');
  assert.deepEqual(hashes(), before, 'Client metadata changed during read-only inspection');
  console.log('PASS no client metadata changes; DNS listener, routing and service access require separate runtime evidence');
} catch (error) {
  // Never dump client YAML or connection credentials on parse failure.
  console.error('FAIL state inspection: ' + (error.code || error.name));
  process.exitCode = 1;
}
