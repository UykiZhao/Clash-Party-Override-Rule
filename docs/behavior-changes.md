# 相对 c5420b9 的行为差异

本次从公开服务清单重写四份 YAML、两份 CONF 和七份补充清单。基线是 `c5420b9b14ebcaa693d7d752b00a914e0627319f`，不是备份分支；[迁移清单](migration-baseline.json) 保存原文件 SHA256、两个场景的每条规则／内联条目、原分组、CONF 参数和清单条目。13 个原文件校验值已逐个与该 Git 提交核对。

## 必要适配

| 项目 | 基线行为 | 本次行为 | 原因与验证 |
| --- | --- | --- | --- |
| 内地两版、港澳单地区 AI 首选 | 手动家宽组为空时停在 REJECT | 首选 `🛟 AI 自动回退`，家宽候选优先；缺少或不健康时依次使用其他代理 | 目标内核验证无家宽、无地区标记、仅 provider、混合布局及偏好故障／恢复；不使用 DIRECT 兜底 |
| 港澳多地区 AI 首选 | 默认美国组，无美国时 REJECT | 自动回退组将美国候选排列在前，随后其他代理 | 有美国时维持美国偏好，无美国时无需改组；不会按全球最低延迟选 AI 地区 |
| 单地区总入口 | 手动组首个实际节点；首节点故障时需要人工选择 | 首选 `🛟 通用自动回退`，实际节点仍可手动选 | 普通代理／流媒体默认路径能按健康检查选择可用代理；手动 DIRECT 项没有进入自动组 |
| 同一偏好内选择 | 家宽手动首节点；港澳多地区美国默认按该地区延迟选择 | AI 自动入口按候选顺序选择第一个健康节点 | 保留家宽／美国出口偏好，减少不同节点布局对初始化路径的影响；若需要某个具体节点，原手动入口仍可选 |
| 排序兼容 | 没有排序辅助 provider | 增加 `__override_sort_anchor` 内联 provider，唯一条目为 `订阅排序占位（REJECT）`，由原信息节点过滤器排除 | 1.19.31 对直接节点的多条件筛选先按节点顺序展开；多 provider 时才再次按筛选优先级排序并去重。这个不提供连接的占位保证两种布局一致；不写真实节点、地址、凭据或外部订阅链接 |
| Gemini Notebook 新域名 | 仅覆盖旧 `notebooklm.google.com`／`notebooklm.google`；跳转到新域名后港澳版回落 DIRECT | 补充 `notebook.google.com`／`notebook.google`，完整跳转链保持 AI 出口 | 现场复现三次跳转后到 `?location=unsupported`；Google 已于 2026-07 将 NotebookLM 更名为 Gemini Notebook |
| 港澳 OpenRouter | 命中 AI 备选，初始化默认 DIRECT；保存选择可能改变出口 | `openrouter.ai` 在补充集前显式命中 AI 解锁 | 当前运行时虽因保存选择已走家宽，新增显式规则保证首次导入及重启后仍使用 AI 出口；其余补充 AI 不变 |
| WebRTC STUN | 港澳版三个检测域名落入最终 DIRECT，STUN UDP 显示澳门公网出口 | `stun.l.google.com`、`stun1.l.google.com`、`stun.cloudflare.com` 明确走 AI | Net.Coffee 当前页面实际使用这三个服务器；规则只覆盖精确 STUN 主机，不代理所有 UDP |
| 组数 | 11 / 23 / 7 / 19 | 13 / 24 / 9 / 20，依次为内地单／多、港澳单／多 | 只增加 AI 自动回退，单地区另加通用自动回退；原组和原可选项均保留 |
| 校验工具 | 旧版本指纹、固定机场名、旧 DNS 管理假设 | 审计本机 2.0.3 源码，执行真实合成函数和守卫；新增内核组件／远程资源检查 | 不读取旧覆写作为必需前提，不执行应用入口，不写客户端，不复用旧确认状态 |

自动回退使用 `fallback`、300 秒检查间隔、5000 毫秒超时、`lazy: false`。家宽／地区叶子和无节点的自动组仍 `empty-fallback: REJECT`。新的 AI 自动组直接接收实际候选，用单个反引号分隔“偏好筛选”和“全部候选”，避免将空叶子组误判为一条健康路径。测试检查排序占位不会出现在任何候选列表，也不会新增重复候选。

[目标版本的分组解析实现](https://github.com/MetaCubeX/mihomo/blob/v1.19.31/adapter/outboundgroup/parser.go) 和 [候选排序实现](https://github.com/MetaCubeX/mihomo/blob/v1.19.31/adapter/outboundgroup/groupbase.go) 是这项兼容处理的依据。它依赖已实测版本的行为，后续升级内核必须重跑候选、空组、provider 更新与故障回退测试。

## 保持不变

| 范围 | 逐条保留的内容 |
| --- | --- |
| 内地 YAML | 42 个规则集、原 63 条路由全部保留；另加 3 条精确 STUN 路由；原顺序保持：私网／系统检测 → 指定 DNS 与检测站 → 国内保护 → 广告／遥测 → AI／通讯／视频 → 流媒体 → GitHub／学术／Google → Microsoft／Apple → 国内兜底 → 海外代理兜底 |
| 港澳 YAML | 15 个规则集、原 17 条路由全部保留；另加 3 条 STUN 与 1 条 OpenRouter 显式路由；私网 → 国内保护 → 广告／遥测 → 指定 AI → 自定义代理／AI 备选 → 指定流媒体 → 直连兜底 |
| DNS 源文件 | 两个场景各自完整的 `dns!`、解析池、策略顺序、fake-ip 兼容排除、缓存、节点解析池；监听 `127.0.0.1:1053`；内地保留 `direct-nameserver-follow-policy`，港澳不新增 `direct-nameserver` |
| 其余基础字段 | 选择／fake-ip 缓存、TUN、HTTP/TLS/QUIC 嗅探、Geo 来源和更新意图；源字段保留不代表应用合并后逐项生效，见验证报告 |
| 规则资源 | 全部来源、格式、行为、缓存相对路径和 86400 秒更新间隔；没有把不同下载域名描述成容灾机制 |
| iOS | `[General]`、全部原策略组／选项、全部规则顺序、Host、空 MITM；内地 `FINAL,PROXY`、港澳 `FINAL,DIRECT`；原 DNS 池、逐条 `force-remote-dns` 与 UDP REJECT 参数 |
| 七份清单 | 原有效条目和顺序保留；AI 清单增加两个 Gemini Notebook 新域名；其余六表有效条目不变 |

国内保护的四个集合共 126 条，去重并集 124 条；未删除腾讯游戏或诊断域名。其余补充清单分别为：AI 68 条、港澳 AI 23 条、内地流媒体 16 条、遥测 9 条、学术 89 条、解析检测／海外 DNS 补充 30 条。AI 清单比 YAML 去重并集少的四条 OpenAI 子域由父后缀覆盖；校验按双向覆盖等价判断，没有误判为缺失。

内地与港澳 `overseas_ai_extra` 分别为 15／23 条，是保留的场景差异。港澳 Gemini 网页、TikTok、普通 Google、GitHub、Netflix 等仍默认直连；Google AI 清单只为官方 Gemini Notebook 更名新增两个域名。BBC 仍区分英国域名和 `bbc.com`，没有恢复 `iplayer` 关键词。两个自定义后缀在港澳仍进入 AI，内地实测命中代理兜底。Bing 全后缀仍进入内地 AI。

## 应用默认值造成的实际差异

这些是初始化基准下的合并结果，不是本次更改用户选项。2.0.3 默认 `controlDns=false`，四份 `dns!` 完整保留；DNS 守卫没有自动改开关或请求确认。用户在任务期间主动开启了 DNS 覆写，当前状态已单独记入验证报告，不能套用此处的初始化结论。默认 `controlSniff=true` 会覆盖 HTTP/TLS 部分配置和 `skip-domain`，最终只保留 Apple 推送排除，源文件中的 `Mijia Cloud` 没有保留到最终对象。QUIC 配置仍保留。

应用还会覆盖顶层 IPv6、TCP 并发、TUN DNS 劫持数组、Geo 模式、更新开关和 Geo URL。完整字段对照与源代码位置见 [验证报告](validation-2026-09-25.md)。本次没有采用隐藏写入、JS 覆写或修改客户端源码绕过这些机制；其中不满足源文件全部生效的部分明确记为限制。

## 未实施的后续候选

| 候选 | 当前行为 | 拟改变行为 | 受影响文件 | 所需验证 |
| --- | --- | --- | --- | --- |
| 缩小 Bing | 内地 `bing.com` 全后缀进入 AI | 仅确认过的 AI 入口进入 AI，普通搜索走普通策略 | 两份内地 YAML、ai-supplement.list | 搜索、登录、AI 对话分别记录首条命中和出口 |
| 自定义域名独立组 | 两个港澳后缀沿用 AI | 新增独立可选出口 | 两份港澳 YAML、港澳 CONF | 原 AI 默认行为不受影响，自定义业务完整访问 |
| 其他新服务入口 | 已按现场证据补充 Gemini Notebook 新域名；其余沿用基线 | 按证据补充新 Copilot、Sora 或其他入口 | 对应场景 YAML、CONF 和补充清单 | 官方端点核对、登录／资源／API 回归，避免扩大普通服务 |
| DNS 或遥测扩展 | 既有 DNS 端点、兼容排除与九条遥测 | 单独评估提供商、校园解析或新增遥测域名 | 相应 YAML／CONF／telemetry.list | 冷启动解析、直连保护和误拦检查 |
| 港澳其余额外 AI 默认代理 | OpenRouter 已显式改走 AI；其余 AI 备选／AI_EXTRA 默认 DIRECT | 经单独需求改为代理 | 两份港澳 YAML、港澳 CONF | 指定业务、账号和实际出口验证 |

这些候选均没有混入本次重写。
