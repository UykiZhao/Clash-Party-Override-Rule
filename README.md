# Clash Party Override Rule

这是给 Clash Party / mihomo 使用的订阅覆写规则，适合只有一个美国节点，或希望简化为“中国直连、海外代理”的场景。

配置重点：

- 中国大陆域名和中国 IP 直连
- 海外 AI、Google、GitHub、Telegram、YouTube、流媒体解锁走代理
- 国内支付、银行、政务、中国 AI 服务明确直连
- 未匹配流量默认走代理
- 使用 fake-ip、TUN DNS hijack、strict-route、respect-rules 和 no-resolve 降低 DNS 泄露风险

如果只是想完成设置，按下面的“快速配置步骤”操作即可。后面的规则说明和故障排查用于后续优化。

## 快速配置步骤

### 第 1 步：准备订阅

先确认你的代理订阅在 Clash Party 中可以正常导入，并且节点本身可用。

本项目只提供覆写规则，不提供节点。如果 VLESS + Reality + Vision 节点本身连不上，先检查订阅或节点配置。

### 第 2 步：导入覆写文件

在 Clash Party 中进入「覆写」页面，添加 YAML 覆写。

推荐直接使用 raw 链接导入：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/override.yaml
```

也可以下载仓库中的 `override.yaml` 后本地导入。

注意：`override.yaml` 不是完整的 mihomo 配置文件，不要把它当成普通配置文件直接启动。文件中的 `dns!`、`tun!`、`geox-url!` 是 Clash Party 的 YAML 覆写语法。

### 第 3 步：把覆写绑定到订阅

1. 打开「订阅管理」。
2. 编辑你的目标订阅。
3. 在订阅编辑窗口底部找到「覆写」选项。
4. 选择刚才导入的 `override.yaml`。
5. 保存订阅。
6. 手动更新一次订阅。

只导入覆写文件还不够，必须把它绑定到具体订阅上，否则订阅不会应用这套规则。

### 第 4 步：检查 Clash Party 应用设置

进入 Clash Party 的「应用设置」，按下面设置检查。

| 设置项 | 建议值 | 原因 |
| --- | --- | --- |
| TUN 模式 | 开启 | 接管系统流量和 DNS，降低 DNS 泄露概率 |
| DNS 覆写 / 接管 DNS | 关闭 | 避免 Clash Party GUI 默认 DNS 覆盖本项目的 `dns!` |
| 嗅探覆写 / 接管嗅探 | 默认即可 | 只有日志显示嗅探误判时再单独调整 |
| 以管理员权限运行 | 建议开启 | Windows 上 TUN 通常需要管理员权限 |
| 订阅更新使用代理 | 规则集下载失败时开启 | 某些网络无法直连 GitHub 或 CDN |

最重要的是关闭「DNS 覆写」。如果它开启，可能导致本项目的 DNS 防泄露配置被覆盖。

### 第 5 步：关闭浏览器内置安全 DNS

如果浏览器开启了内置 Secure DNS / DoH，可能绕过 Clash Party 的 DNS。

建议在常用浏览器中关闭内置安全 DNS：

- Chrome：设置 -> 隐私和安全 -> 安全 -> 使用安全 DNS
- Edge：设置 -> 隐私、搜索和服务 -> 安全性 -> 使用安全 DNS
- Firefox：设置 -> 隐私与安全 -> DNS over HTTPS

如果你明确知道浏览器 DoH 域名会被 Clash Party 接管，也可以保持开启。但普通用户建议先关闭，方便排查。

### 第 6 步：重载配置

完成上面设置后，执行下面任意一种操作：

- 在 Clash Party 中手动更新订阅
- 重启 mihomo 内核
- 重启 Clash Party

重载后再开始验证。

## 成功标准

### 规则命中检查

打开 Clash Party 日志，访问下面域名，看命中的策略是否符合预期。

| 测试域名 | 预期策略 | 说明 |
| --- | --- | --- |
| `baidu.com` | `🎯 全球直连` | 中国网站直连 |
| `bilibili.com` | `🎯 全球直连` | 中国网站直连 |
| `google.com` | `🚀 节点选择` | 海外网站走代理 |
| `github.com` | `🚀 节点选择` | GitHub 走代理 |
| `chatgpt.com` | `🤖 AI 平台` | 海外 AI 走代理 |
| `claude.ai` | `🤖 AI 平台` | 海外 AI 走代理 |
| `deepseek.com` | `🎯 全球直连` | 中国 AI 直连 |
| `alipay.com` | `🎯 全球直连` | 国内支付直连 |
| `gov.cn` | `🎯 全球直连` | 政务服务直连 |
| `netflix.com` | `🎬 流媒体解锁` | 流媒体走代理 |

如果日志里看不到规则命中，先确认订阅是否已经绑定覆写，并且是否更新过订阅。

### DNS 泄露检查

访问下面网站：

- https://ipleak.net/
- https://www.dnsleaktest.com/
- https://browserleaks.com/dns

正常结果：

- 出口 IP 应显示代理节点 IP。
- DNS 服务器不应显示中国电信、联通、移动、阿里、腾讯等中国 DNS。

如果仍显示中国 DNS，按顺序检查：

1. Clash Party 是否开启 TUN。
2. Clash Party 是否关闭「DNS 覆写」。
3. 浏览器内置 Secure DNS / DoH 是否关闭。
4. 订阅是否已经绑定 `override.yaml`。
5. Clash Party 日志中 DNS 泄露测试域名是否命中代理规则。

## DNS 覆写异常处理

如果导入 `override.yaml` 后仍然出现大量下面的日志：

```text
dns resolve failed: couldn't find ip
can't resolve ip: couldn't find ip
```

优先检查 Clash Party 的「应用设置」。

已验证的异常特征：

- Clash Party 应用级「DNS 覆写」开启后，可能覆盖本文件的 `dns!` 配置。
- 最终生效配置中可能出现 `fake-ip-filter: ["*"]`、`direct-nameserver: []`、`respect-rules: false`。
- 这会导致 DNS 分流和 fake-ip 过滤行为不符合本文件预期，从而在日志中出现大量解析失败。

修复方式：

1. 打开 Clash Party。
2. 进入「应用设置」。
3. 关闭「DNS 覆写」。
4. 保存后等待 Clash Party 热重载，或手动重启 mihomo 内核。

修复后应确认：

- Clash Party 配置中的 `controlDns` 为 `false`。
- 最终生效配置中的 `fake-ip-filter` 不再是单独的 `*`。
- `direct-nameserver` 包含国内 DNS，例如 `https://doh.pub/dns-query`、`https://dns.alidns.com/dns-query`。
- `respect-rules: true` 生效。
- 日志热重载完成后，不再持续出现 DNS 解析失败告警。

「嗅探覆写」不需要因为 DNS 问题直接关闭。只有当日志明确显示 sniffer 造成错误识别、错误分流或访问异常时，再单独调整嗅探相关设置。

## 策略组说明

| 策略组 | 默认 | 用途 |
| --- | --- | --- |
| 🚀 节点选择 | ♻️ 自动选择 | 主代理出口 |
| ♻️ 自动选择 | 自动测速 | 对订阅内节点测速，单节点时等同于使用该节点 |
| 🌐 全部节点 | 手动选择 | 显示订阅内全部真实节点 |
| 🤖 AI 平台 | 代理 | OpenAI、ChatGPT、Claude、Anthropic 等海外 AI |
| 📲 电报消息 | 代理 | Telegram 域名和 IP |
| 📹 油管视频 | 代理 | YouTube |
| 🎬 流媒体解锁 | 代理 | Netflix、Disney+、HBO/Max、Hulu、Prime Video、Spotify、TikTok、Apple TV+ 等 |
| Ⓜ️ 微软服务 | DIRECT | 默认直连，可手动切代理 |
| 🍎 苹果服务 | DIRECT | 默认直连，可手动切代理 |
| 🛑 广告拦截 | REJECT | 拦截常见广告域名 |
| 🎯 全球直连 | DIRECT | 中国和局域网直连 |
| 🐟 漏网之鱼 | 代理 | 未匹配流量默认走代理节点 |

单美国节点场景下没有香港、日本、新加坡等地区组。这样更稳定，也避免节点名不匹配导致策略组为空。

## 分流规则说明

### AI 平台

海外 AI 默认走 `🤖 AI 平台`，覆盖：

- OpenAI / ChatGPT / OpenAI API
- Anthropic / Claude
- Google Gemini / AI Studio / NotebookLM / DeepMind
- Microsoft Copilot / Bing AI
- GitHub Copilot
- Perplexity / Poe / xAI Grok / OpenRouter / Mistral / Cohere
- Hugging Face / Replicate
- Cursor / Windsurf / Codeium
- Midjourney / Stability AI / Runway / Ideogram / Leonardo / ElevenLabs / Suno / Udio

同时保留 `MetaCubeX category-ai-!cn`、`OpenAI`、`Anthropic` 和 ACL4SSR 的 AI/OpenAI 规则集自动更新。静态域名用于补齐规则集滞后的新平台，规则集用于长期维护。

中国 AI 服务默认走 `🎯 全球直连`，覆盖 DeepSeek、Kimi、通义千问、豆包、腾讯元宝/混元、百度文心/一言、智谱、MiniMax、硅基流动、讯飞等。这样可以减少美国出口导致的风控、验证码和绕路。

### 国内支付 / 银行 / 政务

`domestic_sensitive` 规则集明确直连：

- `gov.cn` 及常见政务服务域名
- 支付宝、微信支付、银联、云闪付、京东支付、拉卡拉、易宝、快钱等支付链路
- 工农中建交邮储、招商、浦发、兴业、中信、光大、平安、华夏、广发、民生、北京银行、上海银行、浙商等银行域名

这类服务不建议走海外节点，因为容易触发登录风控、短信校验异常、支付失败或地区异常。

### 流媒体解锁

`🎬 流媒体解锁` 默认走代理节点，覆盖：

- Netflix
- Disney+
- HBO / Max
- Hulu
- Prime Video
- Apple TV+
- Spotify
- TikTok
- Discovery+
- Paramount+ / Peacock / Crunchyroll 等静态补充

能否解锁取决于节点 IP 质量，不是规则本身能完全决定。

## DNS 防泄露原理

本配置采用以下组合：

- `fake-ip`：客户端查询域名时返回 `198.18.0.0/16` 虚拟 IP，由 mihomo 保留域名映射。
- `tun.dns-hijack`：TUN 模式下劫持 UDP/TCP 53 查询到 mihomo DNS。
- `strict-route`：Windows 下可降低多宿主 DNS 行为导致的泄露。
- `respect-rules`：DNS 连接也遵守路由规则。
- `proxy-server-nameserver`：代理节点自身域名只用国内 DNS 解析，避免递归代理。
- `no-resolve`：所有 IP 类规则都带 `no-resolve`，避免为了匹配 IP 规则提前解析域名。

## 常见问题

### 导入后订阅更新失败

常见原因：

- 把覆写文件当成普通配置文件导入。
- 只导入了覆写文件，但没有把它绑定到订阅。
- GUI 的应用级 DNS 覆写覆盖了本文件。
- TUN 需要管理员权限。
- 规则集下载失败。

### 策略组里没有节点

本配置使用 `include-all: true` 自动包含订阅内真实节点，并排除了“流量、到期、官网”等信息节点。

如果真实节点名称刚好包含这些词，删除 `exclude-filter` 后再更新订阅。

### VLESS + Reality + Vision 节点连不上

这通常不是规则问题。检查订阅转换后的节点字段：

- `type: vless`
- `tls: true`
- `flow: xtls-rprx-vision`
- `servername`
- `reality-opts.public-key`
- `reality-opts.short-id`
- `client-fingerprint: chrome`
- Clash Party 使用的 mihomo 内核版本足够新

### 微软或苹果服务访问异常

默认策略是直连，因为这些服务在中国大陆通常有可用接入点。

如果某个微软或苹果服务需要代理，在 Clash Party 的代理页面把 `Ⓜ️ 微软服务` 或 `🍎 苹果服务` 手动切到 `🚀 节点选择`。

### Copilot 或 Bing AI 为什么没有走微软直连

Copilot、Bing AI、GitHub Copilot 属于海外 AI 服务，规则优先级高于微软服务规则，所以会走 `🤖 AI 平台`。这是有意设计。

### 中国 AI 为什么直连

DeepSeek、Kimi、通义千问、豆包、腾讯元宝、文心一言等中国 AI 服务通常使用中国接入点。直连更稳定，也更不容易触发异常登录或地区风控。

### 流媒体仍然无法解锁

规则只能保证流媒体域名走代理节点，不能保证该节点 IP 被流媒体平台认可。

如果 Netflix、Disney+、Hulu 仍提示地区不可用，需要更换可解锁的节点。

### 规则集下载失败

本配置主要使用 `testingcf.jsdelivr.net` 拉取 MetaCubeX `.mrs` 规则集。

如果所在网络无法访问该 CDN，可以把 URL 改为 `raw.githubusercontent.com`，并在 Clash Party 中开启“订阅更新使用代理”。

### 使用机场订阅时会覆盖机场自带规则吗

把本项目的 `override.yaml` 绑定到订阅后，Clash Party 会按覆写逻辑合并并替换订阅配置中的对应部分。通常情况下，本项目的策略组、规则、DNS 和 TUN 配置会优先生效。

但需要注意：

- Clash Party GUI 的应用级设置仍可能覆盖订阅覆写，尤其是「DNS 覆写」。
- 不同机场订阅的节点命名不同，如果策略组为空，优先检查节点是否被 `exclude-filter` 过滤。
- 机场订阅更新后，确认该订阅仍然绑定了本项目覆写。

## 项目文件

- `override.yaml`：Clash Party YAML 覆写文件
- `.gitignore`：忽略本地日志软链、系统文件和临时文件

## 参考资料

- Clash Party 覆写说明：https://clashparty.org/docs/guide/override
- Clash Party YAML 覆写语法：https://clashparty.org/docs/guide/override/yaml
- Clash Party override-hub：https://github.com/mihomo-party-org/override-hub
- mihomo DNS 文档：https://wiki.metacubex.one/en/config/dns/
- mihomo TUN 文档：https://wiki.metacubex.one/en/config/inbound/tun/
- mihomo Rule Providers 文档：https://wiki.metacubex.one/en/config/rule-providers/
- mihomo VLESS 文档：https://wiki.metacubex.one/en/config/proxies/vless/
- MetaCubeX 规则数据：https://github.com/MetaCubeX/meta-rules-dat
- ACL4SSR 规则集：https://github.com/ACL4SSR/ACL4SSR
