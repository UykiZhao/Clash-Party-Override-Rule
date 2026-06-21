# Clash Party Override Rule

面向 Clash Party / mihomo 的订阅覆写配置，适合单节点订阅，尤其是 3X-UI 创建的 VLESS + Reality + Vision 节点。配置重点是中国直连、海外默认代理、AI 平台细化、国内敏感业务直连和 DNS 泄露防护。

## 目标

- 中国大陆域名和中国 IP 直连
- 海外 AI、Telegram、YouTube、Google、GitHub、流媒体解锁、DNS 泄露测试等走代理节点
- 国内支付、银行、政务、中国 AI 服务明确直连
- 未匹配流量默认走代理节点
- 使用 fake-ip、TUN DNS hijack、strict-route、respect-rules 和 no-resolve 降低 DNS 泄露风险

## 文件

- `override.yaml`：Clash Party YAML 覆写文件

注意：`override.yaml` 不是独立 mihomo 配置文件。文件中的 `dns!`、`tun!`、`geox-url!` 是 Clash Party 覆写语法，用于强制替换订阅里的对应对象。

## 导入步骤

1. 打开 Clash Party。
2. 进入「覆写」页面，导入 `override.yaml`。
3. 进入「订阅管理」，编辑目标订阅。
4. 在订阅编辑窗口底部的「覆写」选项中选择该文件。
5. 保存后，手动更新一次订阅。

如果仓库是公开仓库，可以直接使用 raw 链接导入：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/override.yaml
```

## Clash Party 设置检查

Clash Party 的应用级常用配置覆写优先级可能高于订阅覆写。如果 `override.yaml` 里的 DNS 没生效，请检查 GUI 设置：

- 关闭或同步「接管 DNS / DNS 覆写」，否则本文件的 `dns!` 可能被 GUI 默认 DNS 覆盖。
- 关闭或同步「接管嗅探」，否则 sniffer 行为可能与预期不一致。
- 使用完整防泄露方案时，建议开启 TUN 模式并允许管理员权限。
- Windows 上如果 TUN 启动失败，先以管理员权限运行 Clash Party。

## 策略组

| 策略组 | 默认 | 用途 |
|---|---|---|
| 🚀 节点选择 | ♻️ 自动选择 | 主代理出口 |
| ♻️ 自动选择 | 自动测速 | 对订阅内节点测速，单节点时等同于使用该节点 |
| 🌐 全部节点 | 手动选择 | 显示订阅内全部真实节点 |
| 🤖 AI 平台 | 代理 | OpenAI、ChatGPT、Claude、Anthropic 等 |
| 📲 电报消息 | 代理 | Telegram 域名和 IP |
| 📹 油管视频 | 代理 | YouTube |
| 🎬 流媒体解锁 | 代理 | Netflix、Disney+、HBO/Max、Hulu、Prime Video、Spotify、TikTok、Apple TV+ 等 |
| Ⓜ️ 微软服务 | DIRECT | 默认直连，可手动切代理 |
| 🍎 苹果服务 | DIRECT | 默认直连，可手动切代理 |
| 🛑 广告拦截 | REJECT | 拦截常见广告域名 |
| 🎯 全球直连 | DIRECT | 中国和局域网直连 |
| 🐟 漏网之鱼 | 代理 | 未匹配流量默认走代理节点 |

单美国节点场景下没有香港、日本、新加坡等地区组。这样更稳定，也避免节点名不匹配导致策略组为空。

## 规则说明

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

## DNS 防泄露逻辑

本配置采用以下组合：

- `fake-ip`：客户端查询域名时返回 `198.18.0.0/16` 虚拟 IP，由 mihomo 保留域名映射。
- `tun.dns-hijack`：TUN 模式下劫持 UDP/TCP 53 查询到 mihomo DNS。
- `strict-route`：Windows 下可降低多宿主 DNS 行为导致的泄露。
- `respect-rules`：DNS 连接也遵守路由规则。
- `proxy-server-nameserver`：代理节点自身域名只用国内 DNS 解析，避免递归代理。
- `no-resolve`：所有 IP 类规则都带 `no-resolve`，避免为了匹配 IP 规则提前解析域名。

浏览器如果启用了内置 Secure DNS / DoH，可能绕过系统 DNS。建议在 Chrome、Edge、Firefox 中关闭浏览器内置安全 DNS，或确保其 DoH 域名也走代理。

## 验证方法

### 检查规则是否生效

在 Clash Party 日志中访问以下域名：

- `baidu.com` 应命中 `cn_domain`、`GEOSITE,cn` 或 `GEOIP,CN`，走 `🎯 全球直连`
- `google.com` 应命中 `google_domain`，走 `🚀 节点选择`
- `github.com` 应命中 `github_domain`，走 `🚀 节点选择`
- `chatgpt.com` 或 `claude.ai` 应命中 AI 规则，走 `🤖 AI 平台`
- `deepseek.com`、`kimi.moonshot.cn` 应命中中国 AI 规则，走 `🎯 全球直连`
- `alipay.com`、`icbc.com.cn`、`gov.cn` 应命中国内敏感业务规则，走 `🎯 全球直连`
- `netflix.com`、`disneyplus.com`、`hulu.com` 应命中流媒体规则，走 `🎬 流媒体解锁`

### 检查 DNS 泄露

访问：

- https://ipleak.net/
- https://www.dnsleaktest.com/
- https://browserleaks.com/dns

正常结果：

- 出口 IP 应显示代理节点 IP。
- DNS 服务器不应显示中国电信、联通、移动、阿里、腾讯等中国 DNS。

如果仍显示中国 DNS：

1. 确认 Clash Party 已启用 TUN。
2. 确认浏览器内置 Secure DNS 已关闭。
3. 确认 Clash Party 没有用应用级 DNS 覆写覆盖 `override.yaml`。
4. 查看日志中 DNS 泄露测试域名是否命中 `prevent_dns_leak` 或手动 DNS leak 规则。

### 检查国内直连

访问国内网站，例如：

- https://www.baidu.com/
- https://www.bilibili.com/
- https://www.qq.com/

这些应走 `🎯 全球直连`。如果国内网站误走代理，在日志中找到域名，并在 `rules` 的国内规则前增加 `DOMAIN-SUFFIX,example.com,🎯 全球直连`。

## 常见问题

### 导入后订阅更新失败

优先检查 Clash Party 日志。常见原因：

- 把覆写文件当成普通配置文件导入。
- GUI 的应用级常用配置覆写覆盖了本文件。
- TUN 需要管理员权限。
- 规则集下载失败。

### 策略组里没有节点

本配置使用 `include-all: true` 自动包含订阅内真实节点，并排除了“流量、到期、官网”等信息节点。如果真实节点名称刚好包含这些词，删除 `exclude-filter` 后再更新订阅。

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

默认策略是直连，因为这些服务在中国大陆通常有可用接入点。如果某个微软或苹果服务需要代理，在 Clash Party 的代理页面把 `Ⓜ️ 微软服务` 或 `🍎 苹果服务` 手动切到 `🚀 节点选择`。

### Copilot 或 Bing AI 为什么没有走微软直连

Copilot、Bing AI、GitHub Copilot 属于海外 AI 服务，规则优先级高于微软服务规则，所以会走 `🤖 AI 平台`。这是有意设计。

### 中国 AI 为什么直连

DeepSeek、Kimi、通义千问、豆包、腾讯元宝、文心一言等中国 AI 服务通常使用中国接入点。直连更稳定，也更不容易触发异常登录或地区风控。

### 流媒体仍然无法解锁

规则只能保证流媒体域名走代理节点，不能保证该节点 IP 被流媒体平台认可。如果 Netflix、Disney+、Hulu 仍提示地区不可用，需要更换可解锁的节点。

### 规则集下载失败

本配置主要使用 `testingcf.jsdelivr.net` 拉取 MetaCubeX `.mrs` 规则集。如果所在网络无法访问该 CDN，可以把 URL 改为 `raw.githubusercontent.com`，并在 Clash Party 中开启“订阅更新使用代理”。

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
