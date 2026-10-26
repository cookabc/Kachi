// F0 验证结果：codex 生图管线
// 2026-10-26 实测，全部跑通。这个文件不是文档，是给人看的验证记录。

# F0 · codex 生图管线验证

## 结论：可行，已跑通三项关键能力

| 能力       | 命令                                                                    | 结果                                                                        |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 单张生成   | `codex exec --skip-git-repo-check --sandbox workspace-write "<prompt>"` | ✅ 512×512 PNG，落到 `~/.codex/generated_images/<session>/`，需自行 copy 出 |
| 风格锁定   | 提示词里写死线宽/投影/色板                                              | ✅ 厚墨描边 + 硬投影 + 糖果色全部命中                                       |
| 批量一致性 | 一次调用生成 3 张，同一 STYLE 块                                        | ✅ 三张线宽、投影、色板完全同一套                                           |
| 混淆对双生 | 同构图、只改方向与填色                                                  | ✅ supply/demand 成为镜像双生，可直接表达「同一件事的两面」                 |

## 关键实现细节（写代码时必须知道）

1. **输出不直接落目标路径**：codex 先写到 `~/.codex/generated_images/<uuid>/exec-<uuid>.png`，
   再用 `sips` 或 shell 拷到目标。**生成脚本必须自己找最新文件并 rename**，不能假设路径。
2. **尺寸要显式指定**：提示词写 `512x512`，实际出的是 1024 再缩放。
   Kachi 需要两档：`hero` 512、`chip` 128（与现有 `TermArt` 的 `sm/lg/hero` 对应）。
3. **STYLE 块必须逐字复用**：三张批量测试证明，只要提示词里的画风段落一字不差，
   风格就不漂。**画风块抽成一个常量，所有生成调用拼接它**，绝不允许每个词单独写。
4. **`--skip-git-repo-check` 必需**：否则在非 git 目录（如 `/tmp`）跑会被拦。
5. **token 消耗**：单张约 20–26k tokens，三张约 30k。190 张要分批，注意额度。

## 已验证的画风常量（可直接用）

```
Cute sticker-style vector illustration, thick dark ink outlines (#1B2E24, 3-4px).
Hard offset drop shadow, no blur, offset down-right ~4px, #1B2E24 at 20% opacity.
Candy palette ONLY: lime #58CC02, yellow #FFC800, sky blue #1CB0F6, coral #FF8A65, cream #FFE08A.
Flat colors, no gradients, no texture.
Single centered subject, generous white negative space.
No text, letters, numbers, logos, watermarks.
```

## 样本

- `hedge-style.png` — 雨伞护金币，完整风格
- `batch-supply/demand/hike.png` — 三张同批，风格一致
- `pair-supply/demand.png` — 镜像双生对

## 遗留风险

1. **几何不精确**：`sips` 缩放 + 生成模型的构图自由，两张「双生」不是像素级一致。
   → 若混淆对要求严格对齐，需后处理（裁切到统一内容框）或接受近似。
2. **额度未知**：190 张 × 约 25k tokens ≈ 475 万 tokens。需先确认账户额度与单日限制。
3. **无文字约束**：模型偶尔仍会画文字，需在脚本里加校验（可选 OCR 或人工抽检）。
