# 语料说明 / Corpus

这里的文件是**词库分层的证据**，不是课程内容。`docs/vocabulary-system.md` 里每一条
「这个词该教」的判断都应该能在这里找到出处。

## 文件

| 文件 | 内容 | 用途 |
|---|---|---|
| `headlines.json` | 172 条真实财经新闻标题（`econ` / `metal` / `company` / `forex` 四域） | 校验 T1 层：学完能否读懂首屏标题 |
| `1.txt`–`6.txt` | 6 篇完整正文（约 2,300 词）：银行财报、外汇宏观、印度债券、炼油利润、矿业财报、公司快讯 | 校验 T2–T5 层：正文里的术语密度远高于标题 |

## 为什么用正文而不只是标题

标题是压缩过的。实测同一批新闻：

- 标题里出现 `bond`/`yield`/`inflation` 这类宏观词，但几乎没有 `earnings-per-share`、
  `funding costs`、`credit quality`、`capital ratios`、`book values`、`unrealised losses`；
- 正文一篇就带出这六七个术语。

**只用标题做语料，会把词库做成「宏观新闻词表」。**

## 采集方式

- 标题：商品资讯 MCP 的 `search_news`，分类 `Economics` / `Metal` / `TopNews` / `Forex`，
  时间 2026-08 至 2026-10。
- 正文：同源 `get_news_detail`，挑的是术语密度高的几类（银行财报、外汇周评、债市、
  炼油利润、矿业财报）。

## 授权

标题与正文均来自公开新闻，**只用于词频统计与验证，不进入课程内容**。
课程里的例句一律原创（见 `content/packs/*/course.json` 的 `sources` 字段），
不复用这里的原文。保留本目录是为了让「为什么教这个词」可复核。

## 校验用法

`scripts/validate-content.mjs` 会读这里的文件，检查每个 pack 的 `concept.term`
在对应语料里至少出现过一次。新增 pack 时，先补语料，再写词表。
