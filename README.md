# Clash Party Override Rule

这是一个面向 Clash Party / mihomo 的订阅覆写配置。

## 目标

- 中国大陆域名和中国 IP 直连
- 海外 AI、Telegram、YouTube、Google、GitHub、流媒体解锁、DNS 泄露测试等走美国节点
- 国内支付、银行、政务、中国 AI 服务明确直连
- 通过 fake-ip、TUN DNS hijack、strict-route、respect-rules 和 no-resolve 降低 DNS 泄露风险

## 文件

- `override.yaml`：Clash Party YAML 覆写文件
- `使用说明.md`：导入、验证和常见问题说明

## 使用方式

1. 在 Clash Party 的「覆写」页面导入 `override.yaml`。
2. 在「订阅管理」中编辑目标订阅。
3. 在订阅的「覆写」选项中选择该覆写文件。
4. 保存并更新订阅。

更多细节见 `使用说明.md`。

