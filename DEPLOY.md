# Melix Teacher — Cloudflare 部署文档

> 部署日期：2026-09-05
> **正式地址：https://melix.fun**（自定义域名，国内直连，无需VPN）
> 备用地址：https://melix-teacher.melix-zsc.workers.dev
> 源项目：`beijing-english-tutor`（阿里云 101.201.79.224 Docker 版，已停用/不可达）

---

## 2026-09-06 (第三批) 双供应商故障切换（DeepSeek 余额耗尽应对，已上线并实测）

**事件**：DeepSeek 账户 402 Insufficient Balance，全平台 AI 功能中断。

**方案**：Worker 内置供应商链，主力失败自动切备用（`src/worker.js` → `providerChain()` + `callAI()`）：

| | 主力 | 备用 |
|---|---|---|
| 供应商 | DeepSeek（Anthropic 兼容端点） | 智谱 GLM（open.bigmodel.cn/api/anthropic，协议相同） |
| 模型 | deepseek-v4-pro | glm-5.3-flash |
| key | secret `ANTHROPIC_AUTH_TOKEN` | secret `ANTHROPIC_BACKUP_AUTH_TOKEN` |
| 思考 | `ANTHROPIC_THINKING` | `ANTHROPIC_BACKUP_THINKING` |

- 切换规则：402 余额不足/403 鉴权 → 立即换下一家；429/5xx/网络/空回复 → 本家重试后换；`/api/config` 的 `backupConfigured` 可查备用是否生效
- **DeepSeek 充值后无需改代码，主力自动恢复**（每次请求多 ~0.3s 的 402 探测）
- ⚠️ 当前备用 key 是智谱 Coding Plan key（与 Claude Code 共用额度）；量大会互相挤占，建议单独买一个智谱 API key 后 `npx wrangler secret put ANTHROPIC_BACKUP_AUTH_TOKEN` 一换即可
- GLM 指令服从性弱：词汇出题 prompt 已强化「一题不落/禁止追问/必须含 json」（buildVocabPrompt 末行），实测 GLM 10题/10条JSON/零追问 17s
- ⚠️ 踩坑：`wrangler secret put` 前用 node 管道喂值，node 22.12.0 段错误导致**空 secret 上传成功**（`backupConfigured:false`）；secret 值一律用 bash grep/sed 提取

实测（线上）：出题 7s 正常；20 题词汇批 50-52s 全量三版；强化 prompt 后 GLM 完整出 10 题+JSON。

## 2026-09-06 (第二批) 思考提速 + 侧栏全部历史 + PDF AI 兜底（已上线并实测）

关键实测：`thinking:{type:'disabled'}` 在 deepseek-v4-pro 上有效（同题 12s→2s）；`budget_tokens` 是「最少思考量」下限，反而更慢。思考开关走环境变量 `ANTHROPIC_THINKING`（disabled/enabled+`ANTHROPIC_THINKING_BUDGET`/auto）。

| # | 需求/问题 | 修复 |
|---|---|---|
| 1 | 思考时间压到 15s 内 | Worker 请求体按 env 控制 `thinking` 参数，默认 disabled。实测：10题单选 28s→**12s**（0 个 thinking 增量）；20题词汇批（1.16万字）44s 全量返回 |
| 2 | 词汇批「生成中断：模型未返回内容」 | Worker 加「零正文自动重试」：流正常结束但无正文 → 抛可重试错误，callAI 自动重试（此前只发过 status/thinking，重试不重复内容） |
| 3 | 左侧导航显示所有历史会话 | 侧栏默认「全部 Agent」汇总（含 Agent 徽标、收藏/有内容优先排序、跨 Agent 搜索），点其它 Agent 的会话自动切换；`melix_conv_scope` 可切回「当前」 |
| 4 | 词汇检测不能读 PDF | PDF 提取到文字但本地规则匹配失败时，自动走 **AI 结构化兜底**（aiExtractVocabItems，仅输出 JSON 词组）→ 不再让用户粘贴；扫描件仍明确提示 |

## 2026-09-06 (第一批) 出题无响应/慢 + 历史会话消失 修复（已上线并实测）

实测根因：**deepseek-v4-pro 是重思考模型**（一次出题请求 1192 个 thinking 增量 vs 673 个正文增量），且 reasoning token 计入 `max_tokens`。

| # | 问题 | 修复 |
|---|---|---|
| 1 | 🔴 出题「愣是没反应」 | `max_tokens` 4096→**8192**：思考耗尽旧预算后正文为空；前端忽略 `type:'error'` SSE 事件→空气泡。两处均已修，另加空回复兜底提示 |
| 2 | 🔴 等待 1 分钟零反馈 | thinking 增量原被 Worker 丢弃 → 现透传为 `thinking` 事件，前端显示「💭 深度思考中… Ns」实时倒计时（桌面+手机） |
| 3 | 🔴 最长 4 分钟静默 | 首字节也用 120s 超时×3次重试 → 拆分：连接 45s / 流式空闲 120s；连接成功即发 `status` 事件 |
| 4 | 🟠 429「请求过于频繁」误伤批量出题 | 限流 10→30 次/分 |
| 5 | 🟠 出题过程卡顿 | 桌面端每个 SSE 增量都全量 `JSON.stringify+saveAll`、手机端每个增量全量重渲染 → 均改为只在结尾持久化/只刷新最后一个气泡 |
| 6 | 🔴 历史会话消失（桌面） | localStorage 写满后 `setItem` 抛错被静默吞掉 → 之后所有保存失效。现写满自动裁最旧非收藏会话（跳过当前会话）重试，仍失败才提示 |
| 7 | 🔴 历史会话消失（手机） | 手机端 `M.stores` 从不上云，iOS 满 7 天清 localStorage = 永久丢失。现 `cloudSync` 按端备份（手机→`cur.mstores`，桌面→`cur.sessions`），恢复接口同步还原两端 |
| 8 | 🟡 云备份超 1MB 被 Worker 413 拒绝 | 超限时逐级缩小消息窗口（20→8→3→1）保住备份 |

实测（2026-09-06 线上）：出 10 道过去时单选题 28s 返回，status/thinking/text/done 事件齐全，正文 1745 字含答案解析；`/login`（307→login.html 新版资源行为）200 正常。

---

## 域名绑定（2026-09-05 完成）

- 域名：`melix.fun`（阿里云注册，有效期至 2027-07-29）
- 接入方式：域名 DNS 从阿里云 hichina 切换到 Cloudflare（iris/yahir.ns.cloudflare.com），免费计划
- Zone ID：`108936a03a4762c863c2c459f19ae638`
- 绑定配置：wrangler.jsonc → `routes: [{ pattern: "melix.fun", custom_domain: true }]`，HTTPS 证书自动签发
- 国内直连实测：HTTP 200，约 1 秒响应

---

## 2026-09-05 Bug 修复清单（13 项，全部实测验证）

| # | 严重度 | 问题 | 修复 |
|---|---|---|---|
| 1 | 🔴 数据丢失 | 每次刷新各 Agent 新建一个空会话，20 次刷新后旧会话（含生成的试卷）被挤掉 | 复用已有空会话；裁剪时优先保留有内容的会话 |
| 2 | 🔴 数据丢失 | 会话云备份(5s)与词库云备份(3s)两个定时器独立读-改-写，互相覆盖 | 合并为单次 cloudSync() 原子读写 |
| 3 | 🔴 功能错乱 | 词汇批量生成中切换 Agent，后续批次写进别的 Agent 的会话 | 生成期间禁止切换 Agent/新建/切换/删除会话 |
| 4 | 🔴 安全 | /api/chat 无鉴权，公网可盗刷 DeepSeek key；/api/students 学生隐私公开 | Worker 端强制 JWT；前端 3 处聊天请求带 token；401 自动跳登录 |
| 5 | 🔴 内容重复 | Worker 上游超时/5xx 重试时，已流出的内容会重复输出 | 首字节写出后禁止重试 |
| 6 | 🟠 手机端 | 看不到/管不了历史会话（CSS 有 .m-history-list 但没有实现） | Agent 页头加 🕘 按钮：会话列表/切换/删除 |
| 7 | 🟠 手机端 | 无法导出 Word 试卷 | Agent 页头加 📄 按钮：试卷版/答案版/教师版；exportDocFrom() 双端共用 |
| 8 | 🟠 手机端 | 用户气泡显示内部前缀（[难度：小学][学生：Nandy…]） | 气泡存原始文本，带前缀版本仅发 API |
| 9 | 🟠 手机端 | 学生列表硬编码，新建学生看不到 | 改为 /api/students 拉取，失败回退默认列表 |
| 10 | 🟡 | 手机端 #/agent 路由不带 agent id，刷新后 Agent 丢失 | hash 改为 #/agent/grammar，刷新可恢复 |
| 11 | 🟡 | _saveStore(null) 往 localStorage 写 'melix_null' 垃圾 | 加 agentId 有效性判断 |
| 12 | 🟡 | 断线报错提示「请确认已运行 node server.js」误导 | 改为通用网络错误文案 |
| 13 | 🟡 | favicon.ico 404（控制台报错） | 未修（无实际影响，后续可加） |

---

## 架构对照

| 阿里云原版 | Cloudflare 版 | 费用 |
|---|---|---|
| Docker + Nginx (80→3000) | Workers（API）+ Static Assets（静态） | 免费 |
| ECS 按量/包月 | 无服务器，边缘运行 | ¥0 |
| 文件存储 data/users/*.json | KV `user:<uid>` | 免费额度 |
| 进程内验证码 codeStore | KV `code:<phone>` TTL 300s（跨 isolate 可靠） | 免费额度 |
| data/students/*.json | KV `student:<id>` | 免费额度 |
| data/<uid>/tutor-data.json | KV `udata:<uid>` | 免费额度 |
| CLAUDE.md + references/ 运行时读盘 | 构建期打进 Worker（kb/ 文本模块，零读盘） | — |

免费额度（每天）：Worker 请求 10万次；静态资源**不限量**；KV 读 10万次 / 写 1千次。
本平台规模（个位数用户）用量 << 1%。

## 已验证 ✅（2026-09-05）

- `/api/health`、`/api/config`、静态页（/、login.html、logo、vendor库）
- 登录链路：send-code → KV验证码 → login 签发 JWT → me
- 学档：POST/GET `/api/user/data`（KV 读写回读一致）
- 学生档案：`/api/students` 已迁移 nandy/yiyi（含全部 sessions）
- 安全屏蔽：`/CLAUDE.md`、`/data/*`、`/references/*`、`.bak-`、隐藏文件 → 404
- `/api/chat`：SSE 流式代码已部署（需填真实 DeepSeek key 后实测）

## 数据迁移（seed/ → KV）

| KV key | 内容 |
|---|---|
| `user:u_6f25...` 等 4 个 | 用户（18232089130 已提升为 admin，可开 admin.html） |
| `phone:<手机号>` → uid | 登录 O(1) 索引 ×4 |
| `student:nandy` / `student:yiyi` | 学生档案全量 |
| `udata:u_b45b...` / `udata:u_c4a6...` | 个人工作区数据 ×2 |

注：本地 seed 是 7月初测试数据。阿里云服务器（22端口超时，疑似已释放）上的最新数据未能取回。

## Secrets（已设置）

- `JWT_SECRET`：随机 32 字节 hex（旧 token 全部失效，重新登录即可）
- `ANTHROPIC_AUTH_TOKEN`：**占位符 `sk-YOUR-DEEPSEEK-KEY`，聊天功能需替换为真实 DeepSeek key**：
  ```bash
  cd "D:/1AI运营/🏗️ 主力项目/melix-cloudflare"
  npx wrangler secret put ANTHROPIC_AUTH_TOKEN   # 粘贴 key 后自动重新部署
  ```

## 日常操作

```bash
cd "D:/1AI运营/🏗️ 主力项目/melix-cloudflare"
npx wrangler dev          # 本地调试 (127.0.0.1:8787，secret 在 .dev.vars)
npx wrangler deploy       # 部署上线
npx wrangler tail         # 看线上实时日志
```

改前端：直接编辑 `public/*.html` → deploy（30秒生效，无需登录服务器、无 Docker volume 坑）。
改知识库/系统提示词：编辑 `src/kb/*` → deploy。

## ⚠️ 大陆访问限制（唯一遗留问题）

`workers.dev` 域名在大陆被 DNS 污染（解析到 Twitter/FB IP），**北京直连打不开**（VPN/代理可正常用，服务本身全球在线）。

解决方案 = 给 Worker 绑定自有域名（Cloudflare 免费含 SSL，域名解析托管到 CF 后国内可直连）：

```jsonc
// wrangler.jsonc 增加自定义域名（假设域名是 example.com）
"routes": [ { "pattern": "melix.example.com", "custom_domain": true } ]
```

需要：一个域名（CF 上注册约 $10/年，或用现有域名托管到 CF）。有域名后一条命令完成绑定。

## 回滚

阿里云版未删除（仅 22 端口超时）。如需彻底放弃 CF，原 Docker 项目文件仍在 `beijing-english-tutor/`。
