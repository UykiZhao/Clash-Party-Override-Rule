#!/usr/bin/env ruby
# Portable static validation of all six deliverables and their immutable migration inventory.
require 'yaml'
require 'json'
require 'optparse'
require 'set'
ROOT = File.expand_path('..', __dir__)
FILES = %w[rule_single.yaml rule_multi.yaml rule_special.yaml rule_special_multi.yaml].freeze
options = {}
OptionParser.new do |o|
  o.on('--mihomo PATH') { |v| options[:core] = File.expand_path(v) }
  o.on('--client-data PATH') { |v| options[:client] = File.expand_path(v) }
end.parse!
def insist(ok, message)
  raise message unless ok
end
def load_yaml(file)
  walk = lambda do |node|
    if node.is_a?(Psych::Nodes::Mapping)
      keys = node.children.each_slice(2).map { |k, _| k.value }
      insist(keys.uniq == keys, "Duplicate YAML key: #{File.basename(file)}")
    end
    (node.children || []).each { |child| walk.call(child) } if node.respond_to?(:children)
  end
  text = File.read(file)
  walk.call(Psych.parse_stream(text))
  YAML.safe_load(text, [], [], false)
end
def conf(file)
  sections, section = {}, nil
  File.readlines(file).each do |line|
    line = line.strip
    next if line.empty? || line.start_with?('#')
    if line.start_with?('[')
      section = line[1..-2]
      insist(!sections.key?(section), "Duplicate CONF section #{file}")
      sections[section] = []
    else
      insist(section, "CONF line outside section #{file}")
      sections[section] << line
    end
  end
  sections
end
def list(file)
  File.readlines(file).map(&:strip).reject { |line| line.empty? || line.start_with?('#') }
end
def covers?(rules, rule)
  return true if rules.include?(rule)
  kind, name = rule.split(',')
  return false unless %w[DOMAIN DOMAIN-SUFFIX].include?(kind)
  rules.any? do |other|
    type, suffix = other.split(',')
    type == 'DOMAIN-SUFFIX' && (name == suffix || name.end_with?(".#{suffix}"))
  end
end
baseline = JSON.parse(File.read(File.join(ROOT, 'docs/migration-baseline.json')))
NOTEBOOK_DOMAINS = %w[DOMAIN-SUFFIX,notebook.google.com DOMAIN-SUFFIX,notebook.google].freeze
STUN_MAINLAND = %w[DOMAIN,stun.l.google.com,🤖\ AI\ 平台 DOMAIN,stun1.l.google.com,🤖\ AI\ 平台 DOMAIN,stun.cloudflare.com,🤖\ AI\ 平台].freeze
STUN_SPECIAL = %w[DOMAIN,stun.l.google.com,🤖\ AI\ 解锁 DOMAIN,stun1.l.google.com,🤖\ AI\ 解锁 DOMAIN,stun.cloudflare.com,🤖\ AI\ 解锁].freeze
def insert_after!(values, marker, additions)
  index = values.index(marker)
  insist(index, "Missing insertion marker #{marker}")
  values.insert(index + 1, *additions)
end
def insert_before!(values, marker, additions)
  index = values.index(marker)
  insist(index, "Missing insertion marker #{marker}")
  values.insert(index, *additions)
end
expected_scenarios = JSON.parse(JSON.generate(baseline['scenarios']))
insert_after!(expected_scenarios['mainland']['rule-providers!']['ai_static']['payload'], 'DOMAIN-SUFFIX,notebooklm.google', NOTEBOOK_DOMAINS)
insert_before!(expected_scenarios['mainland']['rules'], 'RULE-SET,ai_static,🤖 AI 平台', STUN_MAINLAND)
insert_after!(expected_scenarios['special']['rule-providers!']['google_ai_dev']['payload'], 'DOMAIN-SUFFIX,notebooklm.google', NOTEBOOK_DOMAINS)
insert_before!(expected_scenarios['special']['rules'], 'RULE-SET,google_ai_dev,🤖 AI 解锁', STUN_SPECIAL)
insert_before!(expected_scenarios['special']['rules'], 'RULE-SET,custom_proxy_domain,🤖 AI 解锁', ['DOMAIN-SUFFIX,openrouter.ai,🤖 AI 解锁'])
configs = FILES.map { |file| [file, load_yaml(File.join(ROOT, file))] }.to_h
configs.each do |file, cfg|
  scene = file.include?('special') ? 'special' : 'mainland'
  # Every baseline item is preserved; only the exact user-approved service fixes are added.
  actual = cfg.reject { |key, _| %w[proxy-groups proxy-providers].include?(key) }
  insist(actual == expected_scenarios[scene], "Unreviewed service/DNS migration: #{file}")
  groups = cfg.fetch('proxy-groups')
  names = groups.map { |g| g.fetch('name') }
  insist(names.uniq == names, "Duplicate group #{file}")
  by_name = groups.map { |g| [g['name'], g] }.to_h
  visiting, done = [], []
  visit = lambda do |name|
    return if done.include?(name)
    insist(!visiting.include?(name), "Group cycle #{file}: #{name}")
    visiting << name
    by_name[name].fetch('proxies', []).each do |target|
      next if %w[DIRECT REJECT].include?(target)
      insist(by_name.key?(target), "Unknown group #{file}: #{target}")
      visit.call(target)
    end
    visiting.pop
    done << name
  end
  names.each { |name| visit.call(name) }
  baseline['groups'][file].each do |old|
    now = by_name.fetch(old['name'])
    permitted = Marshal.load(Marshal.dump(old))
    permitted['proxies'] = ['🛟 AI 自动回退'] + old['proxies'] if old['name'].start_with?('🤖')
    if !file.include?('multi') && old['name'] == '🚀 节点选择'
      permitted['proxies'] = ['🛟 通用自动回退']
    end
    insist(now == permitted, "Unexpected existing group behavior change #{file}: #{old['name']}")
  end
  extras = file.include?('multi') ? 1 : 2
  insist(groups.size == baseline['groups'][file].size + extras, "Unexpected group count #{file}")
  groups.select { |g| g['type'] == 'fallback' }.each do |g|
    insist(g['empty-fallback'] == 'REJECT' && g['lazy'] == false, "Unsafe automatic fallback #{file}")
    if g['name'] == '🛟 AI 自动回退'
      preferred = file == 'rule_special_multi.yaml' ? '🇺🇸 美国-自动' : '🏠 家宽'
      insist(g['filter'] == by_name[preferred]['filter'] + '`.*', "Unsafe AI fallback order #{file}")
      insist(g['include-all'] && !g.key?('proxies'), "AI fallback must contain actual nodes #{file}")
    else
      insist(g['include-all'] && !g.key?('proxies'), "Fallback leaf must contain only actual nodes #{file}")
    end
    insist(g['interval'] == 300 && g['timeout'] == 5000, "Fallback health check drift #{file}")
  end
  providers = cfg.fetch('rule-providers!')
  cfg.fetch('rules').each do |rule|
    parts = rule.split(',')
    insist(providers.key?(parts[1]), "Unknown rule set #{file}") if parts[0] == 'RULE-SET'
    target = parts[0] == 'MATCH' ? parts[1] : parts[2]
    insist((names + %w[DIRECT REJECT]).include?(target), "Unknown route target #{file}")
  end
  cfg.fetch('dns!').fetch('nameserver-policy').each_key do |key|
    next unless key.start_with?('rule-set:')
    key.delete_prefix('rule-set:').split(',').each { |name| insist(providers.key?(name), "Unknown DNS set #{file}: #{name}") }
  end
  paths = providers.values.map { |p| p['path'] }.compact
  insist(paths.uniq == paths, "Provider cache collision #{file}")
  providers.each do |name, provider|
    if provider['type'] == 'inline'
      insist(provider['behavior'] == 'classical', "Wrong inline behavior #{name}")
    else
      valid = provider['format'] == 'mrs' && %w[domain ipcidr].include?(provider['behavior'])
      valid ||= provider['format'] == 'text' && provider['behavior'] == 'domain'
      insist(valid, "Wrong remote format/behavior #{name}")
      insist(provider['interval'] == 86400 && provider['url'].start_with?('https://'), "Remote source drift #{name}")
    end
  end
  ads = cfg['rules'].index('RULE-SET,ads_domain,🛑 广告拦截')
  %w[domestic_sensitive domestic_ai_domain tencent_services tencent_games_static].each do |name|
    insist(cfg['rules'].index("RULE-SET,#{name},🎯 全球直连") < ads, "Direct protection order #{file}")
  end
  insist(cfg['dns!']['listen'] == '127.0.0.1:1053' && !cfg['dns!']['fake-ip-filter'].include?('*'), "DNS scope #{file}")
  anchor = {'__override_sort_anchor' => {'type' => 'inline', 'payload' => [{'name' => '订阅排序占位（REJECT）', 'type' => 'reject'}]}}
  insist(!cfg.key?('proxies') && cfg['proxy-providers'] == anchor, "Unexpected subscription data in override #{file}")
  groups.select { |g| g['include-all'] }.each do |g|
    insist(Regexp.new(g['exclude-filter']).match('订阅排序占位（REJECT）'), "Sort anchor exposed as a candidate #{file}")
  end
  puts "PASS YAML #{file}: full baseline coverage, #{groups.size} groups, #{providers.size} providers, #{cfg['rules'].size} routes"
end
[%w[rule_single.yaml rule_multi.yaml], %w[rule_special.yaml rule_special_multi.yaml]].each do |a, b|
  insist(configs[a].reject { |k, _| k == 'proxy-groups' } == configs[b].reject { |k, _| k == 'proxy-groups' }, "Scenario drift #{a}")
end
puts 'PASS all same-scenario fields (except groups) are identical'
# Ruby checks are preliminary; validate-core.cjs independently exercises the target kernel regex engine.
samples = ['HK 01', 'TPE 01', 'JP 01', 'SG 01', 'US 01', 'US Residential', 'Australia 01', 'CMI 美国 02', 'Premium1 美国', 'VPS', '家宽', '剩余流量 100G']
configs.each do |file, cfg|
  cfg['proxy-groups'].select { |g| g['include-all'] }.each do |g|
    filters = g.fetch('filter', '.*').split('`').map { |s| Regexp.new(s) }
    excluded = Regexp.new(g['exclude-filter'])
    matches = samples.select { |n| filters.any? { |re| re.match(n) } && !excluded.match(n) }
    insist(!matches.include?('剩余流量 100G'), "Information node leaked #{file}")
    next if g['type'] == 'fallback'
    insist(!matches.include?('Australia 01'), "US false positive #{file}") if g['name'].include?('美国')
    if g['name'].include?('香港') || g['name'].include?('新加坡')
      insist((matches & ['CMI 美国 02', 'Premium1 美国']).empty?, "Operator false positive #{file}")
    end
  end
end
puts 'PASS preliminary regex cases; actual kernel verification is separate'
main = configs['rule_single.yaml']['rule-providers!']
special = configs['rule_special.yaml']['rule-providers!']
mappings = {
  'direct-supplement.list' => %w[domestic_sensitive domestic_ai_domain tencent_services tencent_games_static].flat_map { |n| main[n]['payload'] }.uniq,
  'ai-supplement.list' => %w[ai_static overseas_ai_extra].flat_map { |n| main[n]['payload'] }.uniq,
  'overseas-ai-extra.list' => special['overseas_ai_extra']['payload'],
  'streaming-supplement.list' => main['streaming_static']['payload'],
  'telemetry.list' => main['telemetry_domain']['payload'],
  'academic.list' => main['academic_platforms']['payload']
}
expected_lists = JSON.parse(JSON.generate(baseline['lists']))
insert_after!(expected_lists['ai-supplement.list'], 'DOMAIN-SUFFIX,notebooklm.google', NOTEBOOK_DOMAINS)
baseline['lists'].each do |name, old|
  actual = list(File.join(ROOT, 'rules/shadowrocket', name))
  insist(actual == expected_lists[name] && actual.uniq == actual, "Supplement drift/duplicate #{name}")
  insist(actual.all? { |line| line.match(/\A(?:DOMAIN(?:-SUFFIX)?|IP-CIDR6?),[^,]+(?:,no-resolve)?\z/) }, "Invalid list syntax #{name}")
  if mappings[name]
    want = mappings[name]
    insist(want.all? { |rule| covers?(actual, rule) } && actual.all? { |rule| covers?(want, rule) }, "YAML/list coverage mismatch #{name}")
  end
  puts "PASS list #{name}: #{actual.size} entries, baseline preserved with approved additions"
end
baseline['shadowrocket'].each do |file, old|
  data = conf(File.join(ROOT, file))
  expected = JSON.parse(JSON.generate(old))
  if file.include?('special')
    insert_after!(expected['Rule'], 'DOMAIN-SUFFIX,notebooklm.google,AI,force-remote-dns', [
      'DOMAIN-SUFFIX,notebook.google.com,AI,force-remote-dns',
      'DOMAIN-SUFFIX,notebook.google,AI,force-remote-dns'
    ])
    insert_before!(expected['Rule'], 'RULE-SET,https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rules/shadowrocket/overseas-ai-extra.list,AI_EXTRA', [
      'DOMAIN,stun.l.google.com,AI,force-remote-dns',
      'DOMAIN,stun1.l.google.com,AI,force-remote-dns',
      'DOMAIN,stun.cloudflare.com,AI,force-remote-dns',
      'DOMAIN-SUFFIX,openrouter.ai,AI,force-remote-dns'
    ])
  else
    insert_before!(expected['Rule'], 'RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Shadowrocket/OpenAI/OpenAI.list,AI', [
      'DOMAIN,stun.l.google.com,AI,force-remote-dns',
      'DOMAIN,stun1.l.google.com,AI,force-remote-dns',
      'DOMAIN,stun.cloudflare.com,AI,force-remote-dns'
    ])
  end
  insist(data == expected, "Unreviewed CONF migration #{file}")
  insist(data.keys == ['General', 'Proxy Group', 'Rule', 'Host', 'MITM'], "CONF sections #{file}")
  names = data['Proxy Group'].map { |s| s.split(' = ').first }
  insist(names.uniq == names, "Duplicate CONF group #{file}")
  %w[General Host].each do |section|
    keys = data[section].map { |s| s.split(' = ').first }
    insist(keys.uniq == keys, "Duplicate CONF key #{file}")
  end
  data['Rule'].each do |rule|
    p = rule.split(',')
    insist((names + %w[DIRECT PROXY REJECT]).include?(p[0] == 'FINAL' ? p[1] : p[2]), "Unknown CONF target #{file}")
    if %w[RULE-SET DOMAIN-SET].include?(p[0])
      insist(!p.include?('force-remote-dns') && !p[1].end_with?('.mrs'), "Clash-only or inline option on CONF remote rule #{file}")
      if p[1].include?('/UykiZhao/')
        insist(File.file?(File.join(ROOT, 'rules/shadowrocket', File.basename(p[1]))), "Missing local supplement #{file}")
      end
    end
  end
  insist(data['MITM'] == ['hostname ='], "Active MITM #{file}")
  insist(data['Rule'].last == (file.include?('special') ? 'FINAL,DIRECT' : 'FINAL,PROXY'), "Wrong FINAL #{file}")
  puts "PASS CONF #{file}: baseline preserved with approved Notebook/STUN/OpenRouter fixes (iOS runtime untested)"
end
puts 'PASS static checks. These checks do not establish TUN connectivity or service unlock.'
if options[:core]
  args = ['node', File.join(ROOT, 'scripts/validate-client.cjs'), '--mihomo', options[:core]]
  args += ['--client-data', options[:client]] if options[:client]
  exec(*args)
end
