# Kachi

Kachi 是一个本地优先、开源且面向中文用户的财经英语学习平台。
`Hedge or Pledge` 是首个课程包：通过容易混淆的概念，而不是孤立词表，训练读懂英文财经新闻。

## 当前里程碑

已完成 M0 和 M1 的工程基础：

- 从单文件原型提取出独立课程包、领域类型、内容校验与纯学习引擎。
- 提供中文界面、英文术语教学、低压力纠错、IndexedDB 本地学习记录、导入导出和可安装 PWA。
- React 应用（`src/`）实现了设计系统与玩法行为：蛇形学习路径、术语配图教学卡、hearts、实时判题的配对练习（错配扣心并重排队）、间隔复习与 10 题一轮的练习模式；细节见 [DESIGN.md](docs/DESIGN.md) §11。
- 默认不加载远程字体、遥测、广告、账户服务或 AI API。

后续 milestone 只有在学习效果与留存掌握门槛通过后才会推进；完整路线见
[PRD](docs/PRD.md) 和项目讨论记录。

## 本地开发

需要 Node 24+ 与 pnpm 11：

```bash
pnpm install
pnpm dev
```

质量检查：

```bash
pnpm check
```

课程由 `content/packs/` 下的 Git 内容包提供。当前课程为原生中文包（界面与讲解全中文，术语保留英文）；修改内容包或校验规则后运行：

```bash
pnpm validate:content
```

## 隐私与许可证

- 代码：`AGPL-3.0-only`。
- 原创课程和原创教学素材：`CC-BY-SA-4.0`。
- 第三方新闻短引文、链接和品牌保留各自权利，不随课程包重新授权。
- Kachi 不运营官方账号或同步服务。学习数据默认只存在本地设备；未来可由用户自行连接自托管实例。

贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 并使用 DCO sign-off。
