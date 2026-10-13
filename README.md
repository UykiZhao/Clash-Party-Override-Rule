# Clash Party 覆写与 Shadowrocket 配置

四份 Clash Party YAML 覆写、两份 iOS Shadowrocket 配置。节点由自己的订阅提供；内地版国内直连、海外代理，港澳版默认直连、指定服务代理。

**本仓库提供规则覆写文件，不包含订阅节点、凭据、客户端私密配置或辅助运行脚本。** 已按 Clash Party 2.0.3 / mihomo 1.19.31 的配置格式整理 DNS、分流与 WebRTC 规则。

## 选择文件

| 所在网络与节点布局 | 本地文件 | 原有 raw 地址 |
| --- | --- | --- |
| 内地，单地区或少量节点 | [rule_single.yaml](rule_single.yaml) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_single.yaml) |
| 内地，多地区 | [rule_multi.yaml](rule_multi.yaml) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_multi.yaml) |
| 港澳，单地区或少量节点 | [rule_special.yaml](rule_special.yaml) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_special.yaml) |
| 港澳，多地区 | [rule_special_multi.yaml](rule_special_multi.yaml) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/rule_special_multi.yaml) |
| 内地，iOS | [shadowrocket.conf](shadowrocket.conf) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket.conf) |
| 港澳，iOS | [shadowrocket_special.conf](shadowrocket_special.conf) | [导入链接](https://raw.githubusercontent.com/UykiZhao/Clash-Party-Override-Rule/main/shadowrocket_special.conf) |

“单地区”允许多个日常／家宽节点。港澳多地区订阅对应 `rule_special_multi.yaml`。不使用旧的 `rule_single_special.yaml`、`rule_multi_special.yaml` 文件名。

## Clash Party 导入

1. 使用初始化状态的 Clash Party，开启 TUN。已完成初始化和 TUN 授权的用户跳过此步。
2. 导入节点订阅。已有订阅的用户跳过此步。
3. 在“覆写”中添加所选 YAML 的文件或链接，再在订阅编辑页绑定并保存。

四份 YAML 是订阅覆写；每个订阅只绑定其中一份。导入订阅与覆写的先后顺序不限。绑定后关闭应用“DNS 覆写”，让 YAML 完整管理 DNS；嗅探覆写可保持原设置。应用的 TUN 设置需包含 `any:53` 和 `tcp://any:53`，并启用自动路由与自动接口检测。应用受控设置会在订阅覆写之后合并，须核对运行时配置。

四份覆写均取消唯一 TCP 853 引导依赖，并采用独立节点解析和独立直连解析；其中港澳单地区覆写的引导改为两条 IP 形式 DoH（阿里与 Cloudflare），其余三份引导仍为明文 UDP 53（阿里、腾讯），待按内地实测后统一。`https://edge.1molchuan.top/linuxdo` 列在各解析池首位；基础解析明确走 DIRECT，另有阿里 IP DoH；海外域名策略显式经过 AI 组，并保留 Cloudflare／Google IP DoH。Mihomo 同池上游采用并发查询，列表首位不保证每次独占优先。`respect-rules: false` 配合显式 DNS 出口，减少解析路径随业务规则变化。

macOS 校园认证网络建议保留 DHCP DNS，并关闭 Clash Party 的自动设置公共系统 DNS（`autoSetDNS`）功能；本次修复已将该设置关闭。macOS 对局域网 DNS 的 TUN 劫持有限制，须在实际网络确认接管路径。认证受阻时先正常退出客户端、确认自动 DNS 并完成登录，再启动客户端。域名列表和校园 DNS 地址需实测，通用配置不固定校园内网 DNS。回内地后仍需验证自定义 DoH 与备用上游的直连可达性。

内地网络如遇原生 IPv6 抢占分流（连接显示内地运营商 IPv6），确认应用内 IPv6 开关保持关闭即可；四份规则均含 `IP-CIDR6,::/0,REJECT,no-resolve` 兜底，非私网 IPv6 一律拒绝并强制回退 IPv4，切换覆写时无需手动干预。

本地文件导入可用于审阅本次候选配置；实际设备上的出口和服务可用性仍需在目标客户端中自行复测。

## 默认策略

| 业务 | 内地 | 港澳 |
| --- | --- | --- |
| 私网、国内支付／银行／政务、中国 AI、腾讯与游戏保护 | 直连，优先于广告 | 同左 |
| 广告、现有遥测清单 | REJECT | REJECT |
| OpenAI、Claude、列出的 Google AI／Gemini Notebook 工具 | AI 平台 | AI 解锁 |
| Gemini 网页 | AI 平台 | 直连 |
| OpenRouter | AI 平台 | AI 解锁 |
| Grok 等其余海外 AI 补充 | AI 平台 | AI 备选，默认 DIRECT |
| Google 普通业务、GitHub、国际学术平台 | 普通代理入口 | 直连 |
| Telegram、YouTube | 各自应用组 | 直连 |
| Netflix、Disney+ 等主流流媒体 | 流媒体组 | 默认直连 |
| Hulu、港澳指定流媒体 | 流媒体组 | 流媒体组 |
| Microsoft、Apple 普通业务 | 同名组，默认 DIRECT | 直连 |
| 未匹配流量 | 漏网之鱼，默认代理 | 直连 |

四份 YAML 的 AI 组首选 `🛟 AI 自动回退`。内地两版和港澳单地区优先按名称筛选家宽；港澳多地区优先美国。没有偏好候选时使用其他代理候选；健康检查失败后按顺序回退。自动路径不包含 DIRECT。无有效候选或全部不可达时允许明确失败。

单地区的节点选择首选 `🛟 通用自动回退`，仍可手动选实际节点；多地区总入口仍首选 `♻️ 自动选择`。原家宽、地区、应用组及其可选 DIRECT 项保留。手动选择属于偏好操作；保存过的选择会继续生效。

香港、台湾保留手动地区组；日本、新加坡、美国保留自动与手动入口。无地区标记的节点仍进入总入口，信息节点被排除。节点名称只用于筛选，不能认证真实出口、住宅 IP 或服务解锁能力。健康检查不等于平台账号可用。

港澳 Google AI 只包含配置中列出的开发工具与 Gemini Notebook 后缀，不扩展到全部 Google；2026 年品牌迁移后的 `notebook.google.com`／`notebook.google` 已补入。OpenRouter 明确使用 AI 出口；Grok 等其余补充 AI 保留默认直连选项。WebRTC 检测所用的 Google／Cloudflare STUN 域名明确随 AI 出口，并为当前解析到的 STUN IP 保留 `no-resolve` 兜底，避免 Safari 只提交目标 IP 时落入直连；这不代理所有 UDP。`bbc.co.uk`、`bbci.co.uk` 走流媒体，`bbc.com` 直连；TikTok 保持默认直连。两个既有自定义后缀沿用 AI 组。内地 `bing.com` 整个后缀仍属于 AI，没有缩小范围。

## Shadowrocket 导入

1. 导入节点或订阅，并选择可用节点。
2. 导入、启用对应 `.conf`，全局路由选择“配置”。

应用组选 `PROXY` 时使用首页当前节点；`ALL` 为手动选择，`AUTO` 为测速选择。内地保留 AI、Telegram、YouTube、Streaming、Microsoft、Apple；港澳保留 AI、AI_EXTRA、Streaming。AI 和流媒体默认 PROXY，内地 Microsoft／Apple 与港澳 AI_EXTRA 默认 DIRECT。

两份 CONF 均保留国内 DoH、明文主池和明文备用池，并允许直连解析失败后经代理兜底；这与港澳 YAML 的公共 DoH 实现不同。节点不支持 UDP 时仍 REJECT。两份配置无脚本、重写或生效 MITM 主机列表，不需要安装证书。

七份 [补充规则](rules/shadowrocket/) 已逐条核对。CONF 引用线上 raw 清单，本地文件修改不会自动更新线上内容；发布时六份主文件与七份清单须一起发布。AdvertisingLite、China、Apple 的规则表和域名表按上游格式成对引用。

## 维护说明

本仓库只维护规则覆写、Shadowrocket 配置及其补充规则清单。规则文件不包含真实订阅节点或凭据；更新规则后，请在对应客户端重新拉取或重新导入覆写，并自行确认实际出口。

Git 回退只会回退仓库文件，不会恢复客户端已经保存的覆写绑定、节点选择、DNS 缓存或 TUN 状态。
