# Clash Party 覆写与 Shadowrocket 配置

四份 Clash Party YAML 覆写、两份 iOS Shadowrocket 配置。节点由自己的订阅提供；内地版国内直连、海外代理，港澳版默认直连、指定服务代理。

**本次重写已完成仓库与隔离测试，尚未完成真实 TUN／iOS 验收，不能宣称“初始化后导入即用”已全部通过。** 已核对 Clash Party 2.0.3 / mihomo 1.19.31 的真实合成流程。默认嗅探覆写仍会覆盖部分文件参数，具体限制、Z1–Z6 状态和实际测试记录见 [验证报告](docs/validation-2026-09-25.md)。本轮没有切换客户端或发布远端；下方 raw 地址在发布前仍是线上版本。

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

四份 YAML 是订阅覆写；每个订阅只绑定其中一份。导入订阅与覆写的先后顺序不限。DNS 覆写、嗅探覆写、DNS 策略及其他应用设置保持所安装版本的初始化值。正常使用不需要辅助脚本、手工 DNS、修改浏览器或系统网络设置。

本地文件导入可用于审阅本次候选配置。是否已达到真实设备上的导入即用标准，以验证报告中的验收状态为准。

## 默认策略

| 业务 | 内地 | 港澳 |
| --- | --- | --- |
| 私网、国内支付／银行／政务、中国 AI、腾讯与游戏保护 | 直连，优先于广告 | 同左 |
| 广告、现有遥测清单 | REJECT | REJECT |
| OpenAI、Claude、列出的 Google AI 开发工具 | AI 平台 | AI 解锁 |
| Gemini 网页 | AI 平台 | 直连 |
| OpenRouter、Grok 等海外 AI 补充 | AI 平台 | AI 备选，默认 DIRECT |
| Google 普通业务、GitHub、国际学术平台 | 普通代理入口 | 直连 |
| Telegram、YouTube | 各自应用组 | 直连 |
| Netflix、Disney+ 等主流流媒体 | 流媒体组 | 默认直连 |
| Hulu、港澳指定流媒体 | 流媒体组 | 流媒体组 |
| Microsoft、Apple 普通业务 | 同名组，默认 DIRECT | 直连 |
| 未匹配流量 | 漏网之鱼，默认代理 | 直连 |

四份 YAML 的 AI 组首选 `🛟 AI 自动回退`。内地两版和港澳单地区优先按名称筛选家宽；港澳多地区优先美国。没有偏好候选时使用其他代理候选；健康检查失败后按顺序回退。自动路径不包含 DIRECT。无有效候选或全部不可达时允许明确失败。

单地区的节点选择首选 `🛟 通用自动回退`，仍可手动选实际节点；多地区总入口仍首选 `♻️ 自动选择`。原家宽、地区、应用组及其可选 DIRECT 项保留。手动选择属于偏好操作；保存过的选择会继续生效。

香港、台湾保留手动地区组；日本、新加坡、美国保留自动与手动入口。无地区标记的节点仍进入总入口，信息节点被排除。节点名称只用于筛选，不能认证真实出口、住宅 IP 或服务解锁能力。健康检查不等于平台账号可用。

港澳 Google AI 仅包含配置中的八个既有后缀，不扩展到全部 Google。`bbc.co.uk`、`bbci.co.uk` 走流媒体，`bbc.com` 直连；TikTok 保持默认直连。两个既有自定义后缀沿用 AI 组。内地 `bing.com` 整个后缀仍属于 AI，没有缩小范围。

## Shadowrocket 导入

1. 导入节点或订阅，并选择可用节点。
2. 导入、启用对应 `.conf`，全局路由选择“配置”。

应用组选 `PROXY` 时使用首页当前节点；`ALL` 为手动选择，`AUTO` 为测速选择。内地保留 AI、Telegram、YouTube、Streaming、Microsoft、Apple；港澳保留 AI、AI_EXTRA、Streaming。AI 和流媒体默认 PROXY，内地 Microsoft／Apple 与港澳 AI_EXTRA 默认 DIRECT。

两份 CONF 均保留国内 DoH、明文主池和明文备用池，并允许直连解析失败后经代理兜底；这与港澳 YAML 的公共 DoH 实现不同。节点不支持 UDP 时仍 REJECT。两份配置无脚本、重写或生效 MITM 主机列表，不需要安装证书。

七份 [补充规则](rules/shadowrocket/) 已逐条核对。CONF 引用线上 raw 清单，本地文件修改不会自动更新线上内容；发布时六份主文件与七份清单须一起发布。AdvertisingLite、China、Apple 的规则表和域名表按上游格式成对引用。

## 验证与维护

基础静态校验只需 Ruby 标准库：

```sh
ruby scripts/validate.rb
```

[开发者验证报告](docs/validation-2026-09-25.md) 提供实际客户端合成、目标内核、远程资源和组件运行测试的复现命令及边界。这些命令是开发者校验工具，不是客户端使用步骤。完整配置须先经过 Clash Party 合成，不能直接把带 `dns!` 的覆写交给内核。

[行为差异表](docs/behavior-changes.md) 记录新增回退、内部排序占位、保持不变的服务边界和客户端默认值的实际影响。[迁移清单](docs/migration-baseline.json) 保存公开基线逐条规则和校验值，不含订阅节点、密码或令牌。

## 恢复

本轮没有导入或绑定新覆写，也没有改应用设置，因此当前客户端没有本轮变更需要撤回。用户在任务期间主动开启的 DNS 覆写已单独记入验证报告，保持用户当前选择。

仓库配置的基线为 `c5420b9b14ebcaa693d7d752b00a914e0627319f`。先保留需要的未提交修改，再恢复明确列出的六份主文件、七份清单及 README；[验证报告](docs/validation-2026-09-25.md#恢复方法) 给出限定文件范围的命令。不要整库 reset，也不要恢复备份分支的试验文件。

若后续现场启用新覆写，需要在导入前备份此次重装后的订阅与绑定状态；回退时撤回新覆写，恢复该备份中的绑定，不覆盖用户后续主动修改的设置。只回退 Git 不会恢复客户端，仍需核对实际生成配置。
