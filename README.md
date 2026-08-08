# Clash Party Override Rule

mihomo / Clash Party 订阅覆写：国内直连、海外代理、DNS 防泄露。附带 Shadowrocket iOS 配置。本项目只提供规则和 DNS 配置，不提供节点。

## Clash Party 使用

### 1. 选择覆写文件

| 文件 | 场景 |
| --- | --- |
| `rule_single.yaml` | 大陆使用，单节点或少量节点（推荐） |
| `rule_multi.yaml` | 大陆使用，多节点按地区自动分组（香港/台湾/日本/新加坡/美国） |
| `rule_special.yaml` | **港澳地区使用**，默认直连，仅港澳不可用的服务走节点 |

raw 链接：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_single.yaml
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_multi.yaml
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_special.yaml
```

注意：这是 Clash Party YAML 覆写文件，不是完整 mihomo 配置，不要当普通配置直接导入。

### 2. 导入并绑定覆写

1. Clash Party → 「覆写」→ 新建 → 输入上面的 raw 链接（或下载后本地导入）。
2. 「订阅管理」→ 编辑你的订阅 → 底部「覆写」→ 选择刚导入的文件 → 保存。
3. 手动更新一次订阅。

只导入覆写不绑定订阅不会生效。

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

### 4. 关闭浏览器内置安全 DNS

Chrome / Edge / Firefox 设置中关闭「使用安全 DNS / DNS over HTTPS」，否则浏览器可能绕过 Clash Party 的 DNS。

### 5. 重载并验证

更新订阅或重启内核后，看日志命中是否符合预期：

| 测试域名 | 预期策略 |
| --- | --- |
| `baidu.com` / `bilibili.com` | 🎯 全球直连 |
| `deepseek.com` / `alipay.com` | 🎯 全球直连 |
| `google.com` / `github.com` | 🚀 节点选择 |
| `chatgpt.com` / `claude.ai` | 🤖 AI 平台 |
| `netflix.com` | 🎬 流媒体解锁 |

DNS 泄露测试：访问 <https://ipleak.net/> 或 <https://www.dnsleaktest.com/>，结果中不应出现本地网关或运营商 DNS。若出现，按顺序检查：TUN 是否开启 → DNS 覆写是否关闭 → 浏览器安全 DNS 是否关闭 → 订阅是否已绑定覆写。

## rule_multi.yaml 地区分组说明

节点通过名称关键词自动分组（`include-all` + `filter` 正则），无硬编码节点名。节点名含「日本 / Japan / JP / Tokyo」等关键词即自动进入日本组，香港、台湾、新加坡、美国同理。

如果你的机场节点命名不含常见地区关键词，改对应代理组的 `filter` 正则即可，无需修改其他内容。

## Shadowrocket 使用

1. 先在 Shadowrocket 中导入节点或订阅，确认节点可用。
2. 导入配置（按所在地区二选一）：

```text
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket.conf
https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket_special.conf
```

- `shadowrocket.conf`：大陆使用，国内直连 / 海外代理。
- `shadowrocket_special.conf`：**港澳地区使用**，默认直连，仅港澳不可用的服务走节点。

说明：

- 策略组 `ALL` / `AUTO` 会自动过滤「流量、到期、官网」等信息节点；如果你的真实节点名恰好含这些词，改一下组里的 `policy-regex-filter`。
- `Microsoft`、`Apple` 默认直连，可在策略组手动切代理。
- 节点不支持 UDP 时语音/游戏类 UDP 会被拒绝（防静默泄露）；如受影响，把 `udp-policy-not-supported-behaviour` 改为 `DIRECT`。
- 若使用 iCloud Private Relay、第三方 DNS 描述文件或其他 VPN，可能绕过 Shadowrocket 的 DNS，排查泄露时先关闭。

DNS 泄露测试：访问 <https://ipleak.net/> 或 <https://www.dnsleaktest.com/>，结果中不应出现本地网关或运营商 DNS。

## 港澳 Special 版说明

`rule_special.yaml` 和 `shadowrocket_special.conf` 适用于香港/澳门本地网络（以澳门为主）。港澳网络开放，Google、YouTube、Telegram、Gemini 网页版、Grok、Copilot、Perplexity、Poe 等均可直连，因此 Special 版**默认全部直连**，只有以下「港澳也无法访问」的服务走节点：

| 服务 | 原因 |
| --- | --- |
| OpenAI / ChatGPT / Sora | OpenAI 主动封锁港澳，不在支持地区列表 |
| Anthropic / Claude | 封锁港澳 IP |
| Google AI 开发者工具 | AI Studio、Gemini API、NotebookLM、Gemini CLI、Antigravity 仍封锁（Gemini 网页版 2026-03 已对港开放，保持直连） |
| TikTok | 字节跳动退出香港，但**澳门可直连**，默认不代理；赴港使用时取消配置文件中的对应注释即可 |
| Hulu / Peacock / Paramount+ 美区 / BBC iPlayer / Pluto TV / Tubi | 平台区域限制（HBO Max 2024-11 已上线香港，无需代理） |

代理组只有两个：`🤖 AI 解锁` 和 `🎬 流媒体解锁`，默认走 `🚀 节点选择`。策略组、DNS、TUN 等基础配置与大陆版一致，国内支付/银行/腾讯防误拦规则同样保留在广告规则之前。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 策略组为空 | 节点名被 `exclude-filter`（流量/到期/官网等）过滤，删除该字段后更新订阅 |
| 日志大量 `couldn't find ip` | 「应用设置」里关闭「DNS 覆写」 |
| 规则集下载失败 | 开启「订阅更新使用代理」后更新订阅 |
| 流媒体不解锁 | 规则只保证走代理，解锁取决于节点 IP，换节点 |
| 某协议节点连不上 | 检查订阅转换字段和内核版本，与覆写无关 |
| 游戏 UDP 异常 | 不要同时开游戏加速器和 TUN，二选一 |

## 文件说明

- `rule_single.yaml`：Clash Party 单节点覆写（大陆）
- `rule_multi.yaml`：Clash Party 多节点地区分组覆写（大陆）
- `rule_special.yaml`：Clash Party 港澳 Special 覆写
- `override.yaml`：旧版覆写（保留兼容，建议改用 `rule_single.yaml`）
- `shadowrocket.conf`：Shadowrocket 配置（大陆）
- `shadowrocket_special.conf`：Shadowrocket 配置（港澳）
- `rules/shadowrocket/direct-supplement.list`：国内支付/银行/政务/中国 AI/腾讯防误拦直连补充（置于广告规则前）
- `rules/shadowrocket/proxy-supplement.list`：DNS 防泄露补充（境外 DoH 端点、泄露测试镜像、公共 DNS IP）
- `rules/shadowrocket/ai-supplement.list`：海外 AI 静态域名补充（补齐上游规则集未收录的新平台）
- `rules/shadowrocket/streaming-supplement.list`：流媒体静态域名补充

## 参考

- Clash Party 覆写文档：https://clashparty.org/docs/guide/override
- mihomo 配置文档：https://wiki.metacubex.one/
- MetaCubeX 规则数据：https://github.com/MetaCubeX/meta-rules-dat
