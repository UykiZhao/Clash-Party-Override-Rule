# Clash Party Override Rule

mihomo / Clash Party 订阅覆写：内地版国内直连、海外代理；港澳版默认直连、指定服务代理。两种场景均提供单地区和多地区节点配置。附带 Shadowrocket iOS 配置。本项目只提供规则和 DNS 配置，不提供节点。

## Clash Party 使用

### 1. 选择覆写文件

| 文件 | 场景 |
| --- | --- |
| `rule_single.yaml` | 大陆使用，单地区多节点（如日常 + 家宽），AI 默认走家宽 |
| `rule_multi.yaml` | 大陆使用，多节点按地区自动分组（香港/台湾/日本/新加坡/美国） |
| `rule_special.yaml` | **港澳单地区**，默认直连，AI 首选家宽组；保留原文件名和链接 |
| `rule_special_multi.yaml` | **港澳多地区**，默认直连，按香港/台湾/日本/新加坡/美国分组，AI 和流媒体可独立选择地区 |

澳门日常使用、多地区机场订阅，选择 `rule_special_multi.yaml`；同一地区的日常节点 + 家宽组合，继续使用 `rule_special.yaml`。本仓库共四份 Clash Party 覆写；另附两份 Shadowrocket 配置（iOS 为单节点语义：应用组选 PROXY 即首页当前节点），包含应用策略组以及 ALL/AUTO 节点选择组。

raw 链接：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_single.yaml
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_multi.yaml
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_special.yaml
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_special_multi.yaml
```

注意：这是 Clash Party YAML 覆写文件，不是完整 mihomo 配置，不要当普通配置直接导入。

### 2. 导入并绑定覆写

1. Clash Party → 「覆写」→ 新建 → 输入上面的 raw 链接（或下载后本地导入）。
2. 「订阅管理」→ 编辑你的订阅 → 底部「覆写」→ 选择刚导入的文件 → 保存。
3. 手动更新一次订阅。

只导入覆写不绑定订阅不会生效。同一个订阅只绑定上述四份中的一份，不要叠加内地版与港澳版，或单地区版与多地区版。切换时先移除旧版绑定，再绑定新版并更新订阅。

原 `rule_special.yaml` 链接继续对应港澳单地区版，无需迁移。新增文件推送到 GitHub 后 raw 链接才可用；发布前可本地导入验证。

单地区两版的 `🚀 节点选择` 只包含筛选后的实际节点，不再把 `DIRECT` 放在入口默认项。`🏠 家宽` 也只包含名称匹配的候选节点，空组使用 `REJECT`，不自动回退到其他出口。没有家宽节点时，请在 AI 组手动选择 `🚀 节点选择`。更新覆写后检查实际选择，避免沿用客户端保存的旧选项。

### 3. 应用设置检查

「应用设置」中确认（应用级设置优先级高于覆写）：

| 设置项 | 值 | 说明 |
| --- | --- | --- |
| 运行模式 | 规则 | 保证分流规则生效 |
| TUN 模式 | 开启 | 接管系统流量和 DNS |
| DNS 覆写 | **关闭** | 最重要，开启会覆盖本文件的 DNS 防泄露配置 |
| IPv6 | 关闭 | 避免无可用 IPv6 出口时超时 |
| TCP Concurrent | 开启 | |
| 以管理员权限运行 | 开启（Windows） | TUN 和 strict-route 需要权限 |

本机 2.0.2 的应用设置在覆写之后合并：`dns!` / `tun!` / `sniffer!` 仅替换订阅中的相应对象，并非锁定字段。若希望使用文件中的嗅探设置，也需关闭应用「嗅探覆写」（`controlSniff`）；TUN 开关、栈及 DNS 劫持数组仍以应用设置为准。本机当前 DNS 覆写关闭，但嗅探覆写开启，因此实际嗅探参数并不完全等于文件内容。本轮未自动更改这些开关。

### 4. 关闭浏览器内置安全 DNS

Chrome / Edge / Firefox 设置中关闭「使用安全 DNS / DNS over HTTPS」，否则浏览器可能绕过 Clash Party 的 DNS。

### 5. 重载并验证

更新订阅或重启内核后，看日志命中是否符合预期：

| 测试域名 | 内地两版预期策略 | 港澳两版预期策略 |
| --- | --- | --- |
| `baidu.com` / `bilibili.com` | 🎯 全球直连 | 🎯 全球直连 |
| `deepseek.com` / `alipay.com` | 🎯 全球直连 | 🎯 全球直连 |
| `google.com` / `github.com` | 🚀 节点选择 | 🎯 全球直连 |
| `chatgpt.com` / `claude.ai` | 🤖 AI 平台 | 🤖 AI 解锁 |
| `netflix.com` | 🎬 流媒体解锁 | 🎯 全球直连 |
| `hulu.com` | 🎬 流媒体解锁 | 🎬 流媒体解锁 |

内地版 DNS 泄露测试：访问 <https://ipleak.net/> 或 <https://www.dnsleaktest.com/>，结果中不应出现本地网关或运营商 DNS。若出现，按顺序检查：TUN 是否开启 → DNS 覆写是否关闭 → 浏览器安全 DNS 是否关闭 → 订阅是否已绑定覆写。

港澳版将泄露测试网站作为普通流量直连，不要求它们显示代理出口。检查时应区分直连业务与代理业务，不能把测试网站的直连结果作为所有业务都泄露的结论。港澳 YAML 的公共 DoH 连接按自身目标匹配规则、默认直连；`respect-rules` 不意味着每个业务的 DNS 查询都使用该业务的代理出口。四份 YAML 的 DNS 监听地址均限制为 `127.0.0.1:1053`，不对局域网提供 DNS 服务。

港澳版另有 `custom_proxy_domain` 内联规则集，用于放置用户指定要走家宽出口、但不属于任何 AI / 流媒体分类的域名。新增域名时记得同时把它加进 `nameserver-policy` 中对应的海外 DoH 分组，否则解析仍走默认 DoH。

TUN 的「自动探测接口」（`auto-detect-interface`）**不要在 YAML 里改**：TUN 开关、栈、DNS 劫持与自动探测一律以客户端应用设置为准，实测写入 `false` 后港澳场景出现全网 DNS 失效（已恢复默认 `true`）。即便需要调整，也只能在应用设置里改——应用重启时会按自身状态重写 `mihomo.yaml`，手改该文件会被覆盖。

港澳两版同样**不要配置 `direct-nameserver`**：这两版几乎所有流量都走直连，直连 DNS 一旦不可达就是全网瘫痪。2026-09-17 在 CGNAT 网段（`10.244.x.x`）下 `223.5.5.5` / `119.29.29.29` 全部 `i/o timeout`，表现为断网且订阅无法更新。内地两版 `rule_single.yaml` / `rule_multi.yaml` 保留该配置，因为内地到阿里/腾讯 DNS 可达。

### 海外 AI 补充组 `🧪 AI 备选`

四份 YAML 均新增 `overseas_ai_extra` 内联规则集，收录 `ai_static` / `category-ai-!cn` 未覆盖或近期新增的服务（OpenRouter、Grok / x.ai、Perplexity、Mistral、Hugging Face、Replicate、Groq、Together、Fireworks、Poe、Cohere、Lovable、v0 等）。

- 港澳两版：路由到 `🧪 AI 备选`，**默认直连**。港澳网络对这些服务没有网络层限制，只有个别服务会按账号地区拒绝，届时在该组内手动切到 `🏠 家宽` 即可，不必改规则文件。
- 内地两版：路由到 `🤖 AI 平台`，**默认家宽**，与既有 AI 规则一致。

### 遥测拦截 `telemetry_domain`

四份 YAML 均新增该内联规则集，路由到 `🛑 广告拦截`（默认 REJECT，可在组内切回 DIRECT）。收录 Cline 遥测、PostHog、阿里 ARMS、神策、火山 APM、Sentry、New Relic 等上报域名；日志实测 3 天内约 1.4k 次，其中 `otel.cline.bot` 单域名 1,239 次。规则排在腾讯直连保护之后，`badjs.weixinbridge.com` 等腾讯域名不受影响。

### `rule_multi.yaml` 补齐家宽组

内地多地区版此前缺少 `🏠 家宽` 组，`🤖 AI 平台` 只能选 `🚀 节点选择`。现按单地区版同样规则补齐家宽组，并把 `🤖 AI 平台` 的默认项改为 `🏠 家宽`，使两版内地配置的 AI 出口行为一致。

## 多地区分组说明

适用于 `rule_multi.yaml` 和 `rule_special_multi.yaml`。节点通过 `include-all` + `filter` 正则按名称分组，不硬编码机场名或节点名；直接列出的节点和订阅中的 proxy-provider 节点均纳入筛选。

- 地区识别支持常见中英文名称、旗帜，以及 `HK` / `TPE` / `JP` / `SG` / `US` 等缩写；缩写增加字母边界，避免把 `Australia` 中的 `US` 误认成美国。
- 不再仅凭 `CMI`、`NTT`、`M1` 等运营商名称判断地区，避免 `CMI 美国` 或 `Premium1 美国` 被误分到香港、新加坡。只有运营商名称而没有地区标记的节点仍可从总入口选择。
- 香港、台湾为手动选择；日本、新加坡、美国保留自动测速与手动选择两级分组。
- 全局 `♻️ 自动选择` 对筛选后的节点测速；地区自动组只对名称命中本地区的节点测速，不引用其他地区组或总入口。名称含多个地区时仍可能进入多个组，规则不会核验节点的真实出口位置。
- 依赖方向为应用组 → 节点选择 → 地区组 → 地区自动/手动组 → 实际节点。地区组不再反向引用总入口或相互引用，避免循环。
- 空地区组、空家宽组（港澳多地区版）以及无有效节点的全局自动组使用 `empty-fallback: REJECT`，不会自动跨地区或静默改为直连。部分手动策略组仍保留显式 `DIRECT` 选项，只有主动选择才会使用。

**兼容要求（四份 YAML）**：需要支持 `include-all`、`empty-fallback`、内联规则集及 MRS 格式的 mihomo 内核，并由 Clash Party 处理覆写字段。尚未实测最低兼容版本；YAML 可解析不代表旧内核支持全部字段，应按文末步骤校验客户端导出的完整配置。

若节点名不含任何常见地区关键词，节点仍出现在 `🚀 节点选择` 和全局自动组中，可以直接选择；只需修改对应地区的 `filter` 即可补充分组。节点名包含「流量、到期、官网」等信息词时会被排除，真实节点被误筛时需调整 `exclude-filter`。

### 港澳多地区版如何选择出口

`🤖 AI 解锁` 首次默认使用 `🇺🇸 美国`，避免澳门附近的香港节点因延迟较低而被全局测速选中；这不保证美国节点一定解锁，没有美国节点时会拒绝连接，请手动选可用地区。`🎬 流媒体解锁` 默认使用 `🚀 节点选择`，可独立切换地区；两组均可选择 `🏠 家宽`，没有匹配节点时不要选择该组。首次导入或切换版本后，请检查实际选项，客户端可能保留旧选择。

全局测速只判断连接延迟，**不检测 AI 支持地区或流媒体解锁能力**，也不会排除香港节点。AI 访问失败时，在 AI 组选择该服务支持的出口地区和可用节点；流媒体按目标内容地区选择。不会因为节点名包含「家宽」「原生」就验证其 IP 属性，也不保证任何机场节点一定解锁。

## Shadowrocket 使用

1. 先在 Shadowrocket 中导入节点或订阅，手动选择一个可用节点。
2. 导入配置（按所在地区二选一）：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket.conf
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket_special.conf
```

- `shadowrocket.conf`：大陆使用，国内直连 / 海外代理。
- `shadowrocket_special.conf`：**港澳地区使用**，默认直连，仅配置指定的 AI / 流媒体走节点。

3. 在配置列表启用刚导入的文件，将「全局路由」设为「配置」，不要使用全局代理或全局直连代替规则分流。
4. 更新远程规则集后重新连接，检查日志中的规则命中和实际出口。

说明：

- 两份配置均含 `[Proxy Group]`，提供 ALL 手动选择、AUTO 测速及 AI/AI_EXTRA/Streaming 等应用组；应用组选 PROXY 时使用首页当前节点，选 AUTO/ALL 时按对应组选择出口。
- 内地版 Microsoft、Apple 路由到同名策略组，默认 DIRECT，可在组中手动切换代理；AI 与流媒体规则在它们之前匹配。
- 两份配置均无脚本、重写或生效的 MITM 主机列表（保留空 `[MITM]` 段），不需要为本配置安装 MITM 证书。
- 直连补充表在广告规则之前匹配；自建补充清单已与 Clash YAML 同名内联规则集逐条对齐（含腾讯/游戏直连、AI 静态补充、遥测拦截、国际学术平台、海外 AI 补充）。修改本地 `.list` 后需要一并发布，才能通过远程引用生效。
- 上游 blackmatrix7 已将 AdvertisingLite / China / Apple 拆分为 `.list`（关键词/IP/UA）+ `_Domain.list`（域名集）两个文件，本配置按官方要求同时以 `RULE-SET` 与 `DOMAIN-SET` 双引用，缺一会导致对应覆盖面静默缩水。若上游对其他清单做同样拆分，需要同样补 `DOMAIN-SET` 引用。
- `[General]` 已按 Shadowrocket 使用手册修正：`bypass-tun` 更名 `tun-excluded-routes`（旧参数名被静默忽略），移除已弃用的 `bypass-system`。
- 当前两份 CONF 都使用国内 DoH 和明文 DNS/备用 DNS，且 `dns-direct-fallback-proxy = true`，直连解析失败可能转代理；与港澳 YAML 的公共 DoH 方案不同。本轮未改动 DNS 架构，Shadowrocket 侧仍需实机验证。
- 节点不支持 UDP 时语音/游戏类 UDP 会被拒绝（防静默泄露）；如受影响，把 `udp-policy-not-supported-behaviour` 改为 `DIRECT`。
- 若使用 iCloud Private Relay、第三方 DNS 描述文件或其他 VPN，可能绕过 Shadowrocket 的 DNS，排查泄露时先关闭。

内地版可用 <https://ipleak.net/> 或 <https://www.dnsleaktest.com/> 辅助检查代理流量的 DNS 路径，仍需结合连接日志判断，不能仅凭一个网站推断所有应用都没有泄露。港澳版这些测试网站按默认规则直连，其结果不应被当成代理业务的验证结果。

## 港澳 Special 版说明

`rule_special.yaml`（单地区）和 `rule_special_multi.yaml`（多地区）适用于香港/澳门本地网络，以澳门日常使用为主；iOS 对应 `shadowrocket_special.conf`。

两份 YAML 的 **DNS、规则集、路由规则完全一致，区别仅在代理组**：默认全部直连，仅配置中指定的 AI 和流媒体走节点，支付/银行/腾讯等直连保护仍位于广告拦截之前。多地区版不会把内地版的「海外全部代理」兜底带入港澳场景。

| 服务 | 当前配置策略 |
| --- | --- |
| OpenAI / ChatGPT、Anthropic / Claude | AI 解锁组 |
| 配置列出的 Google AI 开发者工具域名 | AI 解锁组；Gemini 网页域名保持直连 |
| Hulu、Peacock、Paramount+、Pluto TV、Tubi、iPlayer 对应规则 | 流媒体解锁组 |
| TikTok | 默认直连；如需代理，YAML 需完整添加规则集、DNS 策略和路由，不能只解除文末路由注释 |
| Google、YouTube、Telegram、GitHub 及其余未匹配业务 | 默认直连 |

以上是仓库当前分流策略，不是各平台实时地区可用性保证。是否可用仍取决于平台政策、账号和具体出口；本次拆分不扩大原 Special 版的代理服务范围。

港澳 YAML 的 BBC 对应规则明确匹配 `bbc.co.uk` 和 `bbci.co.uk`，不再用 `iplayer` 关键词，避免误匹配包含该字符串的无关域名；Shadowrocket 配置自 2026-09-22 起已同步为相同的后缀匹配。域名分流无法只匹配 `/iplayer` 路径，因此 BBC 英国站的其他页面也使用流媒体出口；`bbc.com` 按默认规则直连。不配置 HTTPS 解密来区分页面路径。

单地区版保留原六个策略组，AI 首选 `🏠 家宽` 组；该组只按节点名称筛选，不验证家宽 IP，也不自动故障切换。空组拒绝连接，没有家宽节点时手动选择节点选择入口。多地区版增加地区组、全局测速和可单独选择的家宽组，AI 首次默认美国组，流媒体默认节点选择。

旧草稿 `rule_single_special.yaml`、`rule_multi_special.yaml` 已移至本地 `.local-archive/`（Git 忽略，不发布），不再作为导入入口；单地区继续使用 `rule_special.yaml` 保持原链接有效。

## 导入校验与验证边界

本次在本机 Clash Party 2.0.2 / mihomo v1.19.29 上验证。日志及安装的旧多地区覆写确认存在 `节点选择 → 香港 → 节点选择` 等循环；旧版可复现 `loop is detected in ProxyGroup`，修复后的四份覆写均通过构造完整配置后的 `mihomo -t`。

可重复的基础验证（Ruby 标准库，无需安装依赖）：

```sh
ruby scripts/validate.rb
ruby scripts/validate.rb --mihomo '/Applications/Clash Party.app/Contents/Resources/sidecar/mihomo' \
  --client-data "$HOME/Library/Application Support/mihomo-party"
```

基础脚本检查重复 YAML 键、策略引用与循环、同场景 DNS/规则一致性、地区正则反例；核心测试覆盖合成节点、空节点、provider-only 及本机赔钱机场订阅节点。它只提取订阅节点，不模拟整个客户端合成流程。凭据仅在内存及私有临时目录中处理，临时文件结束后清理，不写入仓库。

**`mihomo -t` 成功不等于远程规则集全部下载成功、节点连通或 AI/流媒体解锁成功。** 本轮未修改正在运行的客户端配置、未切换订阅，未测试 iOS；不宣称官方认证或实机导入全部通过。

发布或使用前仍需完成：

1. **Clash Party**：绑定且仅绑定一份覆写，更新订阅后导出完整配置。用客户端实际使用的 mihomo 内核运行 `mihomo -t -f ./exported-config.yaml`，检查字段支持、节点配置、Geo 数据及规则集下载。不要直接把含 `dns!` 等覆写字段的原文件交给内核测试。
2. **Shadowrocket**：分别导入两份 `.conf`，确认能启用、远程规则集全部下载成功、全局路由为「配置」。依次验证国内支付直连、AI 走当前节点，以及内地版普通海外业务代理／港澳版普通业务直连。
3. **发布完整性**：同时发布两份 `.conf` 和 `rules/shadowrocket/` 下七份 `.list`；本地导入配置也会使用其中写明的远程规则集地址。文件存在于工作区不代表远程 raw 地址已发布或可访问。
4. **连通性**：YAML / CONF 语法、远程规则集下载、节点可用性和平台解锁是不同验证环节；测试通过一个环节不能替代其他环节。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 循环引用 / loop 报错 | 更新多地区覆写并重新生成订阅配置；确认没有同时绑定旧版或其他生成同名分组的覆写。仍报错时提供完整错误文本 |
| 地区组为空 / 显示 REJECT | 检查该地区是否有节点、名称是否匹配 `filter`、是否被 `exclude-filter` 误筛；可先在节点选择中手动选择有效节点 |
| 日志大量 `couldn't find ip` | 「应用设置」里关闭「DNS 覆写」 |
| 规则集下载失败 | 开启「订阅更新使用代理」后更新订阅 |
| 流媒体不解锁 | 规则只保证走代理，解锁取决于节点 IP，换节点 |
| 某协议节点连不上 | 检查订阅转换字段和内核版本，与覆写无关 |
| 游戏 UDP 异常 | 不要同时开游戏加速器和 TUN，二选一 |

## 文件说明

- `rule_single.yaml`：Clash Party 单节点覆写（大陆）
- `rule_multi.yaml`：Clash Party 多节点地区分组覆写（大陆）
- `rule_special.yaml`：Clash Party 港澳单地区覆写（沿用旧链接）
- `rule_special_multi.yaml`：Clash Party 港澳多地区分组覆写
- `shadowrocket.conf`：Shadowrocket 配置（大陆）
- `shadowrocket_special.conf`：Shadowrocket 配置（港澳）
- `rules/shadowrocket/direct-supplement.list`：国内支付/银行/政务/中国 AI/腾讯防误拦直连补充（置于广告规则前）
- `rules/shadowrocket/proxy-supplement.list`：DNS 防泄露补充（境外 DoH 端点、泄露测试镜像、公共 DNS IP）
- `rules/shadowrocket/ai-supplement.list`：海外 AI 静态域名补充（补齐上游规则集未收录的新平台）
- `rules/shadowrocket/streaming-supplement.list`：流媒体静态域名补充
- `rules/shadowrocket/telemetry.list`：遥测/监控上报拦截（对应 YAML telemetry_domain）
- `rules/shadowrocket/academic.list`：国际学术平台（对应 YAML academic_platforms，须排在国内清单前）
- `rules/shadowrocket/overseas-ai-extra.list`：海外 AI 补充（对应 YAML overseas_ai_extra，港澳版默认直连）

## 参考

- Clash Party 覆写文档：https://clashparty.org/docs/guide/override
- mihomo 配置文档：https://wiki.metacubex.one/
- MetaCubeX 规则数据：https://github.com/MetaCubeX/meta-rules-dat
