#!/usr/bin/env ruby
# Local-only validation. Client credentials stay in memory/private temporary files.
require 'yaml'
require 'json'
require 'tmpdir'
require 'fileutils'
require 'open3'
require 'optparse'

ROOT = File.expand_path('..', __dir__)
FILES = %w[rule_single.yaml rule_multi.yaml rule_special.yaml rule_special_multi.yaml].freeze
options = {}
OptionParser.new do |o|
  o.on('--mihomo PATH') { |v| options[:core] = File.expand_path(v) }
  o.on('--client-data PATH') { |v| options[:client] = File.expand_path(v) }
end.parse!
def load_yaml(path)
  text = File.read(path)
  # Fail on duplicate mapping keys rather than silently discarding earlier groups.
  walk = lambda do |node|
    if node.is_a?(Psych::Nodes::Mapping)
      keys = node.children.each_slice(2).map { |k, _| k.value }
      raise "Duplicate YAML key in #{File.basename(path)}" unless keys.uniq == keys
    end
    (node.children || []).each { |child| walk.call(child) } if node.respond_to?(:children)
  end
  walk.call(Psych.parse_stream(text))
  YAML.safe_load(text, [], [], false)
end

def check_groups(config, label)
  groups = config.fetch('proxy-groups')
  names = groups.map { |g| g.fetch('name') }
  raise "#{label}: duplicate group" unless names.uniq == names
  by_name = groups.map { |g| [g['name'], g] }.to_h
  visiting, done = [], []
  visit = lambda do |name|
    return if done.include?(name)
    raise "#{label}: group cycle: #{(visiting + [name]).join(' -> ')}" if visiting.include?(name)
    visiting << name
    by_name[name].fetch('proxies', []).each do |target|
      next if %w[DIRECT REJECT].include?(target)
      raise "#{label}: unknown group reference #{target}" unless by_name.key?(target)
      visit.call(target)
    end
    visiting.pop
    done << name
  end
  names.each { |name| visit.call(name) }
  providers = config.fetch('rule-providers!')
  config.fetch('rules').each do |rule|
    parts = rule.split(',')
    raise "#{label}: unknown rule set" if parts[0] == 'RULE-SET' && !providers.key?(parts[1])
    target = parts[0] == 'MATCH' ? parts[1] : parts[2]
    raise "#{label}: unknown routing policy #{target}" unless (names + %w[DIRECT REJECT]).include?(target)
  end
  config.fetch('dns!').fetch('nameserver-policy', {}).each_key do |key|
    next unless key.start_with?('rule-set:')
    key.delete_prefix('rule-set:').split(',').each do |name|
      raise "#{label}: unknown DNS rule set #{name}" unless providers.key?(name)
    end
  end
end

configs = FILES.map { |f| [f, load_yaml(File.join(ROOT, f))] }.to_h
configs.each { |name, cfg| check_groups(cfg, name); puts "PASS structure #{name}" }
[%w[rule_single.yaml rule_multi.yaml], %w[rule_special.yaml rule_special_multi.yaml]].each do |a, b|
  %w[dns! tun! sniffer! rule-providers! rules].each do |key|
    raise "Scenario drift: #{a} vs #{b}: #{key}" unless configs[a][key] == configs[b][key]
  end
  puts "PASS same-scenario routing/DNS consistency: #{a}, #{b}"
end

sample_names = ['HK 01', 'TPE 01', 'JP 01', 'SG 01', 'US 01', 'US Residential', 'Australia 01', 'CMI 美国 02', 'Premium1 美国', '剩余流量 100G']
synthetic = sample_names.map { |n| {'name' => n, 'type' => 'socks5', 'server' => '127.0.0.1', 'port' => 9} }
configs.each do |name, cfg|
  next unless name.include?('multi')
  cfg['proxy-groups'].select { |g| g['filter'] }.each do |group|
    re = Regexp.new(group['filter'])
    excluded = Regexp.new(group.fetch('exclude-filter', '(?!)'))
    matches = sample_names.select { |n| re.match(n) && !excluded.match(n) }
    raise 'US false positive: Australia' if group['name'].include?('美国') && matches.include?('Australia 01')
    raise 'Region false positive: operator' if (group['name'].include?('香港') || group['name'].include?('新加坡')) && (matches & ['CMI 美国 02', 'Premium1 美国']).any?
  end
end
puts 'PASS region regex negative samples'
configs.each do |name, cfg|
  special = name.include?('special')
  expected = special ? 'MATCH,🎯 全球直连' : 'MATCH,🐟 漏网之鱼'
  raise "#{name}: wrong default route" unless cfg['rules'].last == expected
  ads = cfg['rules'].index('RULE-SET,ads_domain,🛑 广告拦截')
  %w[domestic_sensitive domestic_ai_domain tencent_services tencent_games_static].each do |set|
    index = cfg['rules'].index("RULE-SET,#{set},🎯 全球直连")
    raise "#{name}: direct protection must precede ads" unless index && ads && index < ads
  end
  raise "#{name}: DNS listener exposed to LAN" unless cfg['dns!']['listen'] == '127.0.0.1:1053'
end
ai = configs['rule_special_multi.yaml']['proxy-groups'].find { |g| g['name'] == '🤖 AI 解锁' }
raise 'Macau AI default must not follow global latency' unless ai['proxies'].first == '🇺🇸 美国'
puts 'PASS routing defaults, direct protection, loopback DNS and Macau AI default'
exit unless options[:core]
puts Open3.capture2(options[:core], '-v').first.lines.first
client = options[:client]
scenarios = {'synthetic' => synthetic, 'empty' => [], 'provider-only' => synthetic}
old = nil
if client
  profiles = load_yaml(File.join(client, 'profile.yaml'))
  item = profiles.fetch('items').find { |p| p['name'] == '赔钱机场' }
  raise 'Expected local subscription not found' unless item
  subscription = load_yaml(File.join(client, 'profiles', "#{item.fetch('id')}.yaml"))
  nodes = subscription.fetch('proxies', [])
  raise 'Subscription has no directly listed nodes' if nodes.empty?
  scenarios['local-subscription'] = nodes
  puts "Local subscription: #{nodes.length} nodes (credentials and addresses not printed)"
  configs['rule_special_multi.yaml']['proxy-groups'].select { |g| g['filter'] }.each do |group|
    re, excluded = Regexp.new(group['filter']), Regexp.new(group.fetch('exclude-filter'))
    count = nodes.count { |n| re.match(n['name']) && !excluded.match(n['name']) }
    puts "  #{group['name']}: #{count} matching nodes"
  end
  overrides = load_yaml(File.join(client, 'override.yaml'))
  entry = overrides.fetch('items').find { |p| p['name'] == 'rule_multi.yaml' }
  old = load_yaml(File.join(client, 'override', "#{entry.fetch('id')}.yaml")) if entry
end

Dir.mktmpdir('clash-rule-validation-') do |dir|
  # Only public geodata is copied. Never use the live core's writable working dir.
  if client
    %w[geoip.dat geosite.dat country.mmdb ASN.mmdb].each do |file|
      source = File.join(client, 'work', file)
      FileUtils.cp(source, File.join(dir, file)) if File.file?(source)
    end
  end
  run = lambda do |label, override, nodes, provider_only, expected_failure|
    cfg = override.map { |key, value| [key.delete_suffix('!'), value] }.to_h
    cfg['proxies'] = provider_only ? [] : nodes
    if provider_only
      File.write(File.join(dir, 'nodes.yaml'), {'proxies' => nodes}.to_yaml)
      cfg['proxy-providers'] = {'test' => {'type' => 'file', 'path' => './nodes.yaml'}}
    end
    path = File.join(dir, 'config.yaml')
    File.write(path, cfg.to_yaml)
    File.chmod(0600, path)
    output, status = Open3.capture2e(options[:core], '-t', '-d', dir, '-f', path)
    if expected_failure
      raise 'Old client override did not reproduce expected group cycle' unless !status.success? && output.include?('loop is detected in ProxyGroup')
      puts "PASS regression #{label}: old group cycle reproduced"
    else
      unless status.success?
        # Do not print arbitrary core output, which could include a subscription secret.
        puts "FAIL core #{label} (exit #{status.exitstatus})"
        puts 'ProxyGroup cycle detected' if output.include?('loop is detected in ProxyGroup')
        raise 'Core configuration validation failed; inspect locally with redaction'
      end
      puts "PASS core #{label}"
    end
  end
  run.call('installed old multi', old, synthetic, false, true) if old
  scenarios.each do |scenario, nodes|
    configs.each do |name, cfg|
      run.call("#{name} / #{scenario}", cfg, nodes, scenario == 'provider-only', false)
    end
  end
end
puts 'All checks passed. Syntax/structure only: no live reload or node connectivity/unlock test.'
