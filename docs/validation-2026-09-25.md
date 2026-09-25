# 六份配置重写验证记录 · 2026-09-25

**总体状态：仓库重写与隔离检查已交付；“初始化状态，仅开启 TUN，导入绑定后直接使用”的完整验收未满足。** 用户已在实际客户端绑定港澳单地区版并完成第一轮访问测试；Gemini Notebook 新域名与 WebRTC STUN 分流暴露出缺口，已在候选修复并完成隔离回归，等待更新后的现场复测。其余三份 YAML、真实服务矩阵及 iOS 尚未实测。2.0.3 默认嗅探合并仍有已证实的字段覆盖限制。

执行范围来自 [REWRITE-SPEC.md](../REWRITE-SPEC.md)。初次交付只改仓库；用户随后明确要求发布并自行绑定覆写进行测试。诊断仅只读当前运行配置和内核 API，没有替用户切换节点、策略或应用设置。用户主动开启的 DNS 覆写保持开启，没有代为复原。

## 1. 基线与证据来源

| 项目 | 实际记录 |
| --- | --- |
| 仓库 | `main`，`c5420b9b14ebcaa693d7d752b00a914e0627319f` |
| 开始时的主配置 | 六份主文件均与该提交一致 |
| 开始时的未跟踪内容 | `.audit/`、`.pi/`、`REWRITE-SPEC.md`、两份旧校验脚本；未恢复其中试验配置，保留原需求及已有工作 |
| 客户端 | 本机 Clash Party **2.0.3**，不是旧脚本所假定的 2.0.2 |
| 审计主 bundle SHA256 | `b58112eeca5fb0d2d93b0e4aeb1caf1d13bcd63d17533258eaeb66fa36c93016` |
| 内核 | Mihomo Meta **v1.19.31**，darwin arm64，go1.26.8，with_gvisor |
| 应用 YAML 解析器 | 随应用打包的 `yaml 2.9.1` |
| 初始化 DNS／嗅探／DNS 策略 | `controlDns=false`、`controlSniff=true`、`useNameserverPolicy=false`；开始时源码默认值与现场读值一致 |
| 后续现场变化 | 用户确认主动开启 DNS 覆写；当前 `controlDns=true`，其余两项不变；与初始化基准不同，不能计作初始化验收通过 |
| TUN | 已开启；保存的协议栈、自动路由、自动探测、劫持和其他 TUN 参数与该版本默认值一致 |
| 订阅与覆写 | 当前订阅已绑定 `rule_special.yaml`，全局覆写为零；不输出订阅名、ID、节点地址或凭据 |
| 状态保护 | 校验前后对 `config.yaml`、`mihomo.yaml`、`profile.yaml`、`override.yaml` 比较摘要；没有写入客户端 |

[迁移基线](migration-baseline.json) 保存全部原规则和 13 个配置／清单的 SHA256。13 个摘要已经重新与 `git show c5420b9:<file>` 核对，全部一致。原始节点、完整客户端配置、订阅 URL 和私密连接日志没有写入仓库。

最新客户端报告记录的是现场 `controlDns=true`。工具继续在内存隔离环境中使用经源码核实的初始化值完成校验，没有测试其他开关组合，也没有把现场设置改回去。报告分别记录 `observedBaseline=fail`、`isolatedChecks=pass`，整体状态为 `fail` 并返回退出码 1；这表示现场已偏离原验收基准，不表示 480 次隔离合成或 36 次内核加载失败。各次只读检查前后文件摘要相同，不能据此推断整个任务期间用户未操作客户端。

## 2. 已运行的检查及其边界

| 检查 | 状态 | 实际覆盖 | 不代表 |
| --- | --- | --- | --- |
| `ruby scripts/validate.rb` | 通过 | 六份结构、重复键／组、引用与循环、成对全字段一致、每条基线规则迁移、原组选项、自动组无 DIRECT、七表对应关系 | Shadowrocket 实际导入或业务连通 |
| 真实客户端函数合成 | 通过 | 480 次生成：4 文件 × 8 节点布局 × 3 DNS 输入 × 5 次生成／作用域／重建；真实 DNS 守卫、YAML 合并、全局／订阅覆写顺序与去重 | GUI 导入、订阅远程更新、完整应用重启 |
| 目标内核 `-t` | 通过 | 32 份合成夹具完整配置 + 4 份合入当前完整订阅的配置；TUN 在配置中始终开启 | `-t` 不创建 TUN，不证明规则下载或实际出站 |
| 远程资源检查 | 通过 | 68 个唯一规则资源；下载、MRS 按 behavior 解码、纯域名／RULE-SET 格式、七份本地／线上有效规则逐条比较 | 目标网络的首次无缓存下载、平台服务可用 |
| 内核运行组件 | 通过 | 40 个节点场景，检查实际内核筛选／去重、初始选择、空组、故障与恢复、实际本地 HTTP 转发；116 条业务首命中；8 项 provider 更新／重载／重启检查 | 不含系统 TUN 入站，不计作 Z1–Z6 的完整客户端验收 |
| 当前客户端只读检查 | 失败 | 用户已开启 DNS 覆写，与初始化默认值不同；其余两开关及 TUN 高级设置符合基准，已绑定一份覆写；检查没有写入 | 不能把用户主动改动视为覆写自动修改，也不能把绑定本身当成业务通过 |
| 真实 TUN 与服务账号访问 | 部分执行 | 用户确认 OpenAI／Claude 经美国家宽，Gemini Notebook 旧配置跳转地区不支持，DNS／WebRTC 出口分裂 | 只覆盖当前港澳单地区版和用户报告的站点；修复版尚待现场复测 |
| Shadowrocket iOS | 未执行 | 未在目标 iOS 环境导入、启用两份 CONF | 本地文本解析不能证明 iOS 参数兼容 |

机器可读记录：[客户端](client-validation.json)、[内核运行组件](core-validation.json)、[远程资源](remote-validation.json)。客户端和组件报告记录输入文件摘要，业务记录逐项包含规则、目标组、当前链路、最终合成节点、合成 HTTP 结果；`realServiceAccess` 明确为 `not-run`。

### 现场反馈与本次修复

当前绑定内容的 SHA256 与仓库 `rule_special.yaml` 一致。只读运行态显示 `🤖 AI 解锁 → 🛟 AI 自动回退 → 家宽候选`；`🧪 AI 备选` 因保存过的选择当时也指向家宽。因此 OpenRouter 在该次现场状态并非澳门直连，但旧配置的首次导入默认仍是 DIRECT，不能保证重建后保持美国出口。

实际 HTTP 跳转链为 `notebooklm.google.com → notebook.google.com → notebooklm.google?location=unsupported → notebook.google/?location=unsupported`。旧规则只覆盖 `notebooklm.google.com` 和 `notebooklm.google`；中间的新域名落入港澳最终直连。Google 于 2026-07 将 NotebookLM 更名为 Gemini Notebook，因此加入 `notebook.google.com`、`notebook.google`，并让 OpenRouter 在港澳版于补充集之前显式命中 AI 解锁。[Google 更名公告](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/)

Net.Coffee 当前 WebRTC 页面实际配置 `stun.l.google.com:19302`、`stun1.l.google.com:19302`、`stun.cloudflare.com:3478`。旧港澳规则使这三条 UDP 流量落入 `MATCH → 全球直连 → DIRECT`，因此显示澳门公网地址符合当时的分流；APNIC 将现场的 `103.240.56.20` 登记在澳门科技大学网段。修复仅将三个精确 STUN 主机送入 AI，不扩展到所有 UDP；目标内核已逐条验证首命中和 AI 链，真实浏览器 UDP 仍待更新后复测。[检测页说明](https://ip.net.coffee/webrtc/)、[APNIC RDAP](https://rdap.apnic.net/ip/103.240.56.20)

DNS 检测与上述域名缺口不同。用户主动开启 DNS 覆写后，当前有效配置是 `respect-rules=false`，默认解析器为 `doh.pub`／`dns.alidns.com`；AI 域名策略仍列出 Cloudflare／Google DoH，但 DNS 连接本身不按代理规则选路。APNIC 将检测到的 `8.210.140.120` 登记为 `AlibabaCloud_HK`。这不表示查询退回明文 53，但解析器出口确实与美国家宽出口不一致。mihomo 文档明确说明只有 `respect-rules=true` 时 DNS 连接才遵循路由规则；应用级覆写在 YAML 后合并，纯 YAML 不能把当前有效值反向改回 true。[mihomo DNS 文档](https://wiki.metacubex.one/config/dns/)、[APNIC RDAP](https://rdap.apnic.net/ip/8.210.140.120)

### 节点场景

完整配置合成覆盖：全部样本、空订阅、仅 provider、直接节点与多个 provider 混合、无家宽、无美国、仅无地区标记节点、仅信息节点。组件运行增加偏好节点不可达、全部不可达，并检查偏好恢复。最低样本 `HK 01`、`TPE 01`、`JP 01`、`SG 01`、`US 01`、`US Residential`、`Australia 01`、`CMI 美国 02`、`Premium1 美国`、`VPS`、`家宽`、`剩余流量 100G` 均由目标内核实际筛选。

没有将 Ruby／JavaScript 正则通过当作目标内核兼容结论。地区组不得误收 Australia 或仅凭运营商字符串误判地区；无地区标记节点保留；信息节点和排序占位被排除。测试还检查候选去重与默认链路不自动进入 DIRECT。只有实际候选都不可用或为空时，转发才允许失败。

### 组件环境与就绪判定

组件测试只装载生产文件中的代理组、规则和公开规则集快照，使用回环 HTTP 代理、回环 DNS 和回环 HTTP 服务。所有候选均为测试时构造，不使用真实订阅节点；没有创建系统 TUN、改变系统路由、关闭用户 TUN，或写入客户端控制接口。

测试最初把 `/version` 可访问当成转发就绪，遇到偶发 HTTP 502。已通过目标版本源码确认：控制接口与 INNER 健康检查可在规则集加载期工作，外部 TCP 要等 `tunnel.OnRunning()`。测试现以一次回环私网请求证明转发已就绪，然后才执行一次 AI 默认路径请求，未通过重试 AI 请求掩盖失败。[内核初始化顺序](https://github.com/MetaCubeX/mihomo/blob/v1.19.31/hub/executor/executor.go)、[转发状态判断](https://github.com/MetaCubeX/mihomo/blob/v1.19.31/tunnel/tunnel.go)。

`-t` 使用实际 `generateProfile` 生成的完整配置，不是删除 YAML 键末尾的 `!` 后直接拼节点。真实订阅只在内存和权限 0700 的临时目录处理，配置文件权限 0600，退出后清理。内核组件的收敛耗时只适用于本地夹具，不代表公网节点的恢复时间或服务解锁。

### 下载与冷启动的区别

68 个规则资源通过现有客户端的本地 HTTP 代理下载，核对的是当时线上内容的可达性与格式。这条下载路径未使用本次新覆写，不能证明新配置在目标网络上冷启动无缓存时也能下载。

第一次让空目录中的 `mihomo -t` 自行下载 GeoSite 时，出现 `dns resolve failed: couldn't find ip`。该次使用的合成节点指向关闭的本地端口，不能据此断定真实订阅失败，也不能宣称冷启动通过。随后从**实际合成配置的应用默认 GeoSite URL**独立下载新文件，未复制客户端旧缓存，再运行 36 项 `-t`；这是加载检查的公共数据前置条件，不作为 Z3 通过证据。

七份线上 raw 清单与本地的有效条目相同，但注释字节不同。本轮未发布，六份主文件的线上内容仍不是本次候选。AdvertisingLite、China、Apple 的 `.list` 和 `_Domain.list` 均单独下载、校验格式，保留 RULE-SET／DOMAIN-SET 成对引用。

## 3. 真实应用合并证据

源码位置对应上述完整 bundle 指纹，均为只读提取，未执行应用入口或修改安装文件：

| 源码范围（主 bundle 行号） | 作用 |
| --- | --- |
| 4541–4595 附近 | 真实 parse／stringify／deepMerge；对象 `!` 替换、数组默认替换 |
| 4596–4809 附近 | 2.0.3 初始化常量、应用默认配置和内核受控配置 |
| 11834–11920 | DNS 检测、指纹、守卫和成功应用后的持久化决策 |
| 12010–12146 | generateProfile、GUI 规则层；守卫在普通 YAML 覆写前检查订阅，受控配置在覆写后合并 |
| 12178–12205 | 全局＋订阅覆写 ID 去重与顺序，YAML 覆写执行 |
| 12257 起 | 受控配置读取与默认值合并；开始时只读确认保存值与默认值（加 TUN 开启）一致，后续用户开启 DNS 覆写另记 |

隔离测试为文件读取提供内存数据，为写入提供捕获器；调用的合并、顺序、生成和守卫函数保持原实现。未绑定 JS、Smart 或额外 GUI 规则，因为它们不属于初始化基准；全局与订阅绑定同一份覆写时只应用一次，分别绑定时作用域也有测试。测试拒绝未经复审的版本／指纹，不静默套用旧截取位置。

三类订阅输入为无 DNS、自带 DNS、自带节点解析与 DNS 策略。因为该版本默认 `controlDns=false`，守卫不会自动关闭已经关闭的开关，不依赖确认指纹；`dns!` 完整替换订阅 DNS。即使 `useNameserverPolicy=false`，它删除的也是应用受控 DNS 的策略，不会删掉本文件自带的策略。内地／港澳各自的解析池及 `respect-rules`、节点解析池完整保留。

### 源文件与合成结果对照

| 字段 | 源文件意图 | 2.0.3 初始化＋TUN 合成结果 |
| --- | --- | --- |
| DNS 对象 | 完整 `dns!`、回环 1053、fake-ip 黑名单、场景解析池 | 原样保留；没有加入全匹配 `*` |
| 节点解析 | 独立 `proxy-server-nameserver` | 原样保留；真实节点启动和解析访问尚未实测 |
| 顶层 `ipv6` | false | true；DNS 内部 `ipv6:false` 保留 |
| `tcp-concurrent` | true | false |
| TUN enable／stack／路由／探测 | 开启、mixed、自动路由、自动探测 | 保留应用初始化值且 TUN 开启；不写设备名到覆写 |
| TUN dns-hijack | `any:53` 与 `tcp://any:53` | 应用默认 `any:53` |
| TUN strict-route | true | true；不等于已验证操作系统接管 |
| HTTP 嗅探端口／覆盖目的地 | 80、8080–8880；true | 应用默认 80、443；false |
| TLS 嗅探端口 | 443、8443 | 应用默认 443 |
| QUIC 嗅探 | 443、8443 | 保留 |
| skip-domain | Mijia Cloud、Apple 推送 | 应用数组替换为仅 Apple 推送 |
| 其他嗅探 | 文件已有三类协议 | 应用补入 `override-destination:false` 与默认 skip-dst-address |
| Geo 模式／自动更新 | geodata-mode=true、自动更新=true | 两项均被应用默认 false 覆盖 |
| Geo URL | 文件原有 CDN／GitHub 地址 | 应用默认 MetaCubeX GitHub release 地址 |
| 规则与策略组 | 整表替换 | 整表替换，没有重复追加 |
| 选择／fake-ip 缓存 | true | true；组件已检查可选手动选择跨重载／重启保留 |

因此，完整保留源文件 HTTP/TLS/QUIC 与米家注释不等于这些值都在初始化客户端生效。**在不改变应用嗅探选项的限制下，纯 YAML 无法阻止后续应用合并覆盖同名字段，米家排除项的有效保留未满足。** 没有通过改开关、写内部文件、JS 覆写、修改源码或更改系统网络设置掩盖这一限制。

[Clash Party 覆写机制](https://clashparty.org/docs/guide/override/yaml) 说明覆写与应用配置的优先级；[mihomo DNS 文档](https://wiki.metacubex.one/config/dns/) 定义节点解析池与 direct-nameserver-follow-policy；[TUN 文档](https://wiki.metacubex.one/config/inbound/tun/) 说明接管行为的系统差异。这些文档不能代替目标设备验证。

## 4. Z1–Z6 完整验收状态

这里的状态严格针对方案要求的**完整客户端场景**；已通过的离线子检查在右栏单列，不上推为完整通过。

| 编号 | 状态 | 已有证据与剩余工作 |
| --- | --- | --- |
| Z1 初始化导入绑定并完成业务回归 | 失败（部分执行） | 港澳单地区旧版已绑定；Gemini Notebook 与 STUN 暴露规则缺口，候选已修复、待复测；其余三版和完整业务矩阵未执行 |
| Z2 导入前后选项保持初始化值 | 失败 | 初始值曾只读确认；用户后续主动开启 DNS 覆写，当前现场不符初始化基准；隔离生成没有持久化写入 |
| Z3 无旧规则／DNS 缓存首次加载 | 未执行 | 新下载的规则和 GeoSite 能解析；原生 GeoSite 下载尝试失败，不能用独立下载替代完整冷启动验收 |
| Z4 三类订阅 DNS 与守卫 | 失败（部分执行） | 三类隔离输入的真实合成／守卫通过；现场主动开启 DNS 覆写后有效 `respect-rules=false`，检测到解析器出口与 AI 出口不一致 |
| Z5 缺家宽／美国、无地区标记、仅 provider | 未执行 | 目标内核组件已验证默认选路与合成流量转发；现场仅验证当前两节点布局 |
| Z6 更新订阅／覆写、重启客户端 | 未执行 | 真实生成重复执行无追加；组件 provider 更新、内核重载／重启与选择记忆通过；未实际更新订阅或重启桌面客户端 |

Z1–Z6 未全部通过，故“无需额外设置”保持**未满足／待目标环境验收**，不附加手动修复开关清单。另有上述嗅探有效字段限制，不能因业务样本成功而隐去。

## 5. 业务回归证据

四份 YAML 每份各 29 个域名样本，共 116 条，由实际内核读取当次远程资源快照后选择首条规则。完整明细见 [core-validation.json](core-validation.json) 的 `business`。

| 样本范围 | 内地合成结果 | 港澳合成结果 |
| --- | --- | --- |
| baidu、bilibili、alipay、deepseek、badjs.weixinbridge | 全球直连；腾讯保护先于广告 | 同左 |
| chatgpt、claude、aistudio、notebooklm、notebook.google | AI 平台，默认家宽优先 | AI 解锁；单地区家宽、多地区美国优先 |
| 三个 Net.Coffee STUN 主机 | AI 平台 | AI 解锁 |
| gemini | AI 平台 | 全球直连 |
| openrouter / grok | AI 平台 | 前者 AI 解锁；后者 AI 备选，默认 DIRECT |
| google、github | 节点选择 | 全球直连 |
| netflix | 流媒体 | 全球直连 |
| hulu、peacocktv | 流媒体 | 流媒体 |
| bbc.co.uk / bbc.com | 节点选择 | 前者流媒体，后者直连 |
| sciencedirect | academic_platforms → 节点选择 | 全球直连 |
| otel.cline.bot | 广告组 → REJECT | 同左 |
| 两个既有自定义后缀 | MATCH → 漏网之鱼 → 代理 | custom_proxy_domain → AI 解锁 |
| 新造 `.codexunmatched` 样本 | MATCH → 漏网之鱼 → 代理 | MATCH → 全球直连 |

这些请求抵达的是回环测试服务。合成 204、DNS 返回、代理转发和真实服务账号／内容可用性是不同结论。真实出站 IP、账号访问、AI API、流媒体解锁以及 iOS 的对应行为均未执行。

## 6. 开发者复现命令

正常用户不需要运行以下命令。基础静态验证无需应用安装；客户端与组件工具依赖本次复审的安装版本，版本改变时必须先更新源码审计边界，不能只改指纹跳过复审。

```sh
ruby scripts/validate.rb

node scripts/validate-client.cjs \
  --mihomo '/Applications/Clash Party.app/Contents/Resources/sidecar/mihomo' \
  --report docs/client-validation.json

node scripts/check-remote.cjs \
  --proxy http://127.0.0.1:7890 \
  --report docs/remote-validation.json

node scripts/validate-core.cjs \
  --proxy http://127.0.0.1:7890 \
  --report docs/core-validation.json

bash scripts/clash-tun-check.sh
```

`--proxy` 是本次公共规则下载所用的已有本地代理地址，只供开发者重现下载方法；它不写入主配置，不是导入前提。可省略以检查本机网络下载，但结果不能混记。`--cache-dir` 可在开发者私有临时目录复用**本次新下载**的公开资源，实际本轮组件运行采用这一方式；索引携带原 URL、摘要和格式检查结果。检查结束清理临时目录。

工具失败会返回非零；客户端／组件报告记录本次状态，避免失败后误读旧的通过记录。应用信息、测试节点与输出路径只用于验证，主配置仍为可直接导入的六份文件，没有生成器、JS 覆写或安装辅助脚本的使用前提。

## 恢复方法

本轮未操作现场绑定或应用设置，所以客户端无需为本轮撤回；用户自行开启的 DNS 覆写不属于本轮撤回内容。若后续执行现场验收，先只备份**此次重装之后**、绑定新覆写之前的订阅与绑定；撤回时恢复这份备份，不恢复重装前手工 DNS／缓存／旧确认记录，不覆盖用户后续主动修改的设置。

仓库回退前先保存需要的本次未提交修改，再在仓库根目录限定恢复文件：

```sh
git restore --source=c5420b9b14ebcaa693d7d752b00a914e0627319f -- \
  rule_single.yaml rule_multi.yaml rule_special.yaml rule_special_multi.yaml \
  shadowrocket.conf shadowrocket_special.conf \
  rules/shadowrocket/academic.list rules/shadowrocket/ai-supplement.list \
  rules/shadowrocket/direct-supplement.list rules/shadowrocket/overseas-ai-extra.list \
  rules/shadowrocket/proxy-supplement.list rules/shadowrocket/streaming-supplement.list \
  rules/shadowrocket/telemetry.list README.md scripts/validate.rb
```

新验证文档和工具按需单独保留或移出，不能 `git clean` 删除用户原有未跟踪文件。回退 Git 不会改变客户端；后续现场恢复完成后，仍要检查其实际合成配置、绑定与网络行为。
