# Melix Teacher 部署阿里云 ECS — 技术踩坑挖掘报告

> 数据来源：`C:/Users/zsc/.claude/projects/C--Users-zsc/8bacab09-f06b-45da-8b92-2b0caa2d5c8b.jsonl`
> 会话时间：2026-07-11（时间戳为 jsonl 记录的 UTC 时间，服务器日志为北京时间 +08:00）
> 项目：Melix Teacher 北京英语AI家教平台，部署到阿里云 ECS `101.201.79.224`
> 说明：所有结论均引用 jsonl 原文（标注行号 LINE + 时间戳）。敏感值（API Key / JWT / 手机号）已脱敏。

---

## 会话整体时间线（真实用户输入，origin.kind == human）

| 行号 | UTC 时间 | 用户原话（节选） |
|------|----------|------------------|
| LINE 4 | 03:10:17 | "http://101.201.79.224 这是之前优化的K12家教平台……页面之后上方有黑色条，显示'接入模型是deepseek'" |
| LINE 64 | 03:11:06 | "我需要你隐藏这一行黑色条，不影响原有功能" |
| LINE 73 | 03:12:07 | "怎么告诉你部署方式呢，我不懂，你自己去查看" |
| LINE 136 | 03:16:24 | "还有一个问题就是这个网页里面各个板块又无法回答我的问题了……保证正常可以回答问题"（→ 问题2 API Key） |
| LINE 230 | 13:12:28 | Conversation System Refactor V4.2 规格 |
| LINE 395 | 13:19:34 | "五个agent之间仍然不独立……你赶紧给我修复" |
| LINE 467 | 13:26:03 | Cross Platform Upgrade V4.3 规格 |
| LINE 622 | 13:43:58 | Mobile Workspace V2 规格 |
| LINE 778 | 13:52:55 | "目前还是和之前没有太大变化……"（手机端界面没变，伏笔） |
| LINE 931 | 14:05:10 | "可以，把它部署到我的melix teacher手机端界面" |
| LINE 1014 | 14:08:38 | "还是不行啊，还和原来界面一模一样，咋回事啊你快帮我调整"（→ 问题1 Docker Volume 导火索） |
| LINE 1070 | 15:00:21 | "保留记录我后续回来优化" |

---

## 问题 1 — Docker Volume 挂载缺失（scp 改文件线上不生效）✅ 证据完整

### 用户原话（现象）
> **LINE 1014 | 2026-07-11T14:08:38Z**
> "还是不行啊，还和原来界面一模一样，咋回事啊你快帮我调整"

（同类伏笔更早出现过：LINE 778 | 13:52:55 "目前还是和之前没有太大变化"——本质是同一个 volume 问题导致多次 scp 部署都不生效。）

### AI 排查动作
> **LINE 1017 | 14:08:46**
> "让我直接检查线上实际返回的代码，找出问题。"

关键转折：AI 这次不再 grep 宿主机文件，而是直接 `curl` 容器实际对外返回的 HTML：
> **LINE 1018（命令）**
> `ssh ... "curl -s http://localhost:3000/ | head -250 | tail -60"`
> 返回的是**旧版** HTML（仍是 `mp-agent-badge` 等旧桌面端结构，没有新手机端组件）。

### AI 定位根因（原文）
> **LINE 1021 | 14:08:59**
> "**找到根因了！** Docker 容器没有挂载 `web` 目录——文件是在 `docker build` 时 COPY 进镜像的，所以修改宿主文件不会生效。需要把文件直接拷贝进容器。"

更完整的根因表述：
> **LINE 1067 | 14:10:42**
> "🔍 根因 — **Docker 没有挂载 `web` 目录。** Dockerfile 在 `docker build` 时把 `web/` 内容 COPY 进镜像。之后每次 SCP 修改 host 上的 `/opt/beijing-tutor/web/index.html`，容器内部仍使用**旧镜像里的老文件**，所以界面完全不变。"

### 旁证：build 时 COPY、原 compose 无 web 挂载
- setup.sh 生成的 Dockerfile（**LINE 87 | 03:12:14**）：`WORKDIR /app` + `COPY web/ ./` + `COPY references/ /app/references/` + `COPY CLAUDE.md /app/` —— 证明前端文件是构建期烤进镜像的。
- 修复前服务器上的 docker-compose.yml（**LINE 170 | 03:17:43**）`volumes` 只有：
  ```
  - ./data:/app/data
  - ./references:/app/references
  - ./logs:/app/logs
  ```
  **没有 `./web` 挂载**——这正是根因。

### 最终解决方案（改了哪些文件/配置）
1. **临时生效**（LINE 1022）：`docker cp /opt/beijing-tutor/web/index.html beijing-tutor:/app/index.html && docker compose ... restart`
2. **永久修复**（LINE 1030 | 14:09:17："永久修复：给 web 目录加 volume 挂载，以后 scp 就能直接生效。"）
   服务器 `/opt/beijing-tutor/docker-compose.yml` 增加挂载（LINE 1039 命令）：
   ```
   sed -i 's|volumes:|volumes:\n      - ./web:/app|' /opt/beijing-tutor/docker-compose.yml
   ```
   修复后 volumes（LINE 1040）：
   ```diff
   volumes:
   +  - ./web:/app
     - ./data:/app/data
     - ./references:/app/references
     - ./CLAUDE.md:/app/CLAUDE.md
     - ./logs:/app/logs
   ```
3. **重建容器**（LINE 1043）：`docker compose down && docker compose up -d`
4. **同步本地部署配置**（LINE 1063）：`deploy/aliyun/docker-compose.prod.yml` 也加 `- ../../web:/app`，防止下次部署复发。

### 验证
> **LINE 1047/1049 | 14:10**：`curl -s http://localhost:3000/ | grep -o 'm-bnav|m-home-hero|...'` 返回 8 个手机端组件（`m-home-hero / m-task-num / m-student-btn / m-fab / AGENT_PREFIX` 等）。
> **LINE 1052 | 14:10:24**："**现在全部生效了！** 8 个关键移动端组件都已正确加载。"

### 简历可用角度
> 一个隐蔽的"部署假成功"陷阱：多次 scp + restart 都"成功"，AI 早期验证只 grep 宿主机文件（LINE 385）因此误判已生效；真正的突破是把验证手段改成"curl 容器实际对外服务的内容"，才发现宿主机与容器内容不同步，根因是镜像构建期 COPY、运行期无 volume 挂载。

---

## 问题 2 — API Key 为空（env_file 未加载 .env）✅ 证据完整

### 用户原话（现象）
> **LINE 136 | 2026-07-11T03:16:24Z**
> "还有一个问题就是这个网页里面各个板块又无法回答我的问题了，你帮我解决这个问题，保证各板块功能正常顺利使用且以后不管做任何调整都不能破坏这部分功能，保证正常可以回答问题"

### 真实报错（原文）
AI 直接打 `/api/chat` 接口，拿到 DeepSeek 返回：
> **LINE 158（tool_result）| 03:17:18**
> `data: {"type":"error","error":"Authentication Fails, Your api key:  is invalid"}`
> （注意 "api key:" 后面是**空的**——key 没传进去。）

### AI 排查与根因（原文）
> **LINE 161 | 03:17:27**
> "找到根因了！**API Key 为空**，导致 DeepSeek 认证失败。让我确认容器内的环境变量。"

对比证据（关键）：
- 容器内环境变量（**LINE 164 | 03:17:30**）：`ANTHROPIC_AUTH_TOKEN=`（**空值**）
- 而宿主机 `.env` 文件里（**LINE 142 / LINE 171**）明明有：`ANTHROPIC_AUTH_TOKEN=sk-5185****`（已脱敏）

> **LINE 167 | 03:17:40**
> "**确认了！** `ANTHROPIC_AUTH_TOKEN` 在容器内是空的，API key 没有传进去。同时 `BASE_DIR` 路径也不对。让我修复。"

> **LINE 174 | 03:17:49**
> "问题明确了：`env_file` 没有正确加载 `.env` 文件内容到容器中。我直接重写 docker-compose.yml，把环境变量显式写进去，同时修复 `BASE_DIR` 路径。"

### 最终解决方案
重写服务器 `/opt/beijing-tutor/docker-compose.yml`（**LINE 175**）：**删除 `env_file: - .env`，改用显式 `environment:` 块**直接把变量写死传入：
```yaml
environment:
  - PORT=3000
  - NODE_ENV=production
  - JWT_SECRET=1705****（已脱敏）
  - ANTHROPIC_AUTH_TOKEN=sk-5185****（已脱敏）
  - ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
  - ANTHROPIC_MODEL=deepseek-v4-pro
  - BASE_DIR=/app
  - INVITE_MODE=false
```
然后 `docker compose down && up -d` 重建（LINE 179）。

### 验证
> **LINE 189 | 03:18:16**：容器内 `env` 现在有 `ANTHROPIC_AUTH_TOKEN=sk-5185****`、`BASE_DIR=/app`。
> **LINE 196 | 03:18:32**：`/api/chat` 正常流式返回（"我是/你的/专属/AI/英语/教师/平台……"）。

### AI 总结（原文）
> **LINE 222 | 03:19:05**
> "问题根因：Docker 容器的 `env_file` 没有正确加载 `.env` 文件，导致 `ANTHROPIC_AUTH_TOKEN` 为空 → DeepSeek API 认证失败 → 所有板块无法回答问题。"
> 修复表第 2 行："API Key 为空，所有板块无响应 | docker-compose.yml 改用显式 `environment` 传参"

---

## 问题 3 — BASE_DIR 路径错误（知识库 / CLAUDE.md 加载失败）✅ 证据完整

### 现象（容器启动日志，原文）
> **LINE 141（docker logs）| 03:16:30**
> ```
> ⚠️ 知识库缺失: references/grammar-scope.md
> ⚠️ 知识库缺失: references/beijing-exam-system.md
> ⚠️ 知识库缺失: references/exam-templates.md
> ```

### 根因链（原文证据）
- 错误来源：setup.sh 生成 `.env` 时写的是 `BASE_DIR=$DEPLOY_DIR`，即 `/opt/beijing-tutor`（**LINE 87 setup.sh 第90行 | 03:12:14**）；`.env.production` 也是 `BASE_DIR=/opt/beijing-tutor`（**LINE 89 | 03:12:15**）。
- 但容器内 Dockerfile 的 `WORKDIR` 是 `/app`（**LINE 87 Dockerfile**），知识库实际在 `/app/references/`。
- 容器内验证（**LINE 159 | 03:17:20**）：`docker exec ... ls /app/references/` 有全部 md 文件；而 `ls /opt/beijing-tutor/` 在容器内**只有一个 data 目录**，没有 references——所以按 `BASE_DIR=/opt/beijing-tutor` 去找知识库必然失败。

> **LINE 167 | 03:17:40**
> "……同时 `BASE_DIR` 路径也不对。让我修复。"

### 最终解决方案（三处同步修改）
1. 服务器 docker-compose.yml `environment` 里 `BASE_DIR=/app`（**LINE 175**）。
2. 服务器 `.env` 用 sed 修正（**LINE 219**）：`sed -i 's|BASE_DIR=/opt/beijing-tutor|BASE_DIR=/app|' /opt/beijing-tutor/.env` → 输出 `BASE_DIR=/app`（LINE 220）。
3. 本地 setup.sh 同步修正（**LINE 215**）：`BASE_DIR=$DEPLOY_DIR` → `BASE_DIR=/app`（防止下次部署复发）。

### 验证
> **LINE 189 | 03:18:16**：容器内 `BASE_DIR=/app`。
> **LINE 195 | 03:18:24**（启动日志）：
> ```
> ✅ 已加载 CLAUDE.md (/app/CLAUDE.md)
> ✅ 已加载知识库: references/textbook-database.md (6939 字)
> ✅ 已加载知识库: references/grammar-scope.md (4891 字)
> ✅ 已加载知识库: references/beijing-exam-system.md (2516 字)
> ✅ 已加载知识库: references/exam-templates.md (2904 字)
> ```
> **LINE 199 | 03:18:40**："✅ **BASE_DIR**：修正为 `/app`（容器内正确路径）"

> AI 总结表第 3 行（**LINE 222**）："BASE_DIR 路径错误，知识库加载失败 | 改为 `/app`（容器内实际路径）"

---

## 问题 4 — 登录验证码（手机端输入验证码报错/停留登录界面）⚠️ 本文件未找到完整排查链条

**结论：在本 jsonl 文件中，未找到"手机端输入验证码后报错或停留在登录界面"的【用户反馈→排查→根因→解决】链条。** 本次会话的 13 条真实用户输入里没有任何一条提及验证码/登录故障。相关证据如下，供如实引用：

### 本文件中确实存在的验证码相关内容（背景，非排障）
1. **验证码机制是正常的（工作日志，原文）**——本次会话中验证码登录是**成功**的：
   > **LINE 141（docker logs）| 03:16:30**
   > ```
   > [03:15:15] POST /api/auth/send-code
   > 📱 验证码 [182****7737]: 589298
   > [03:15:17] POST /api/auth/login
   > [03:15:17] GET /            ← 登录后正常进入主页
   > ```
2. **开发态验证码固定为 123456 / 显示在页面上**（短信未接入）：
   - deploy.bat（**LINE 81 | 03:12:12**）："开发模式验证码: 123456"、"验证码(开发): 123456"
   - quick-deploy.txt（**LINE 85 | 03:12:14**）："验证码: 123456"
   - `.env` 中短信配置全部注释（**LINE 80 / LINE 89**）："短信服务（生产环境需要接入腾讯云短信）# SMS_SECRET_ID= …"
3. **登录鉴权门**（前端 AUTH CHECK，原文）——无 token 或 `/api/auth/me` 失败即跳登录页：
   > **LINE 1019（线上 HTML）| 14:08:50**
   > `var token=localStorage.getItem('tutor_token'); if(!token){window.location.href='/login.html';return} fetch('/api/auth/me'...).catch(function(){localStorage.removeItem('tutor_token');window.location.href='/login.html'});`

### "验证码 Bug 修复"出处（更早会话，非本文件细节）
AI 在会话末尾读到的记忆文件（**LINE 1080 | 15:00:41**，其 frontmatter 标注 `date: 2026-07-06`、`originSessionId: 6f415129-d425-48f8-9bd5-1f95996bcc55`，即**另一个更早的会话**）中提到：
- "验证码 | 点击发送后直接显示在页面上（未配置短信）"
- "昨天完成的工作 …… 验证码 Bug 修复"

> 即：**"验证码 Bug 修复"是 2026-07-06 那次会话做的事**，本文件（2026-07-11）只是在 memory 里复述了一句，**没有任何排查过程、报错原文或修复细节**。如要在简历中引用验证码排障，需去调取 `6f415129-d425-48f8-9bd5-1f95996bcc55` 那个会话的 jsonl，本文件无法支撑该结论。

---

## 问题 5 — 部署架构（Nginx 反代 / DeepSeek / Anthropic 兼容端点）✅ 证据完整

### AI 对架构的总览（原文）
> **LINE 61 | 03:11:06**
> "技术架构：
> - 前端：单页 HTML（`web/index.html`，约 890 行），纯原生 JS + CSS
> - 后端：Node.js HTTP 服务（`web/server.js`，约 480 行）
> - AI 接口：通过 DeepSeek Anthropic 兼容 API（`api.deepseek.com/anthropic`），模型 `deepseek-v4-pro`
> - 数据存储：本地 JSON 文件 + localStorage"

> **LINE 95 | 03:12:21**
> "看明白了，项目部署在阿里云服务器 `101.201.79.224`，Docker + Nginx 架构。"

### Nginx 反向代理 80 → 127.0.0.1:3000（原文，setup.sh 生成的 nginx 站点配置）
> **LINE 87（setup.sh）| 03:12:14**
> ```nginx
> server {
>     listen 80;
>     server_name ${DOMAIN:-_};
>     client_max_body_size 50m;
>     location / {
>         proxy_pass http://127.0.0.1:3000;
>         proxy_http_version 1.1;
>         proxy_set_header Host $host;
>         proxy_set_header X-Real-IP $remote_addr;
>         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
>         proxy_read_timeout 120s;
>         ...
> ```

### 容器只暴露本地 3000，由 Nginx 反代（原文）
- docker-compose `ports`：`"127.0.0.1:3000:3000"`（**LINE 87 / LINE 165 / LINE 170**）
- 本地 docker-compose.prod.yml 注释（**LINE 165 | 03:17:31**）：`- "127.0.0.1:3000:3000"   # 仅本地访问，通过Nginx反向代理`

### DeepSeek + Anthropic 兼容端点（原文，环境变量）
> **LINE 89（.env.production）/ LINE 142（服务器 .env）**
> ```
> ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
> ANTHROPIC_MODEL=deepseek-v4-pro
> ```
> 健康检查（**LINE 149 / LINE 1010**）：`{"status":"ok","model":"deepseek-v4-pro"}`

### 运维通道（原文）
- SSH：`ssh -i ~/.ssh/id_ed25519_beijing_tutor root@101.201.79.224`（**LINE 122 起反复使用**）
- 部署路径：`/opt/beijing-tutor/`（**LINE 106 / LINE 146**）
- 重启：`docker compose -f /opt/beijing-tutor/docker-compose.yml restart`（**LINE 110 / LINE 85 quick-deploy**）
- 安全组开放 80/443（**LINE 85 quick-deploy.txt**）

---

## 附：本次会话沉淀的"关键修复记录"（AI 写入 memory，可作为交叉印证）

会话结尾 AI 把四个修复写进了项目记忆文件（**LINE 1082 | 15:00:53**，原文摘录）：
- **Docker Volume 挂载**：问题"scp 修改 web/index.html 后界面不变"；根因"Docker 镜像 build 时 COPY 文件，无 volume 挂载则修改 host 文件不生效"；修复"docker-compose.yml 增加 `- ./web:/app`，已重建容器"。
- **API Key 为空**：根因"`env_file` 未正确加载 .env 到容器"；修复"docker-compose.yml 改用显式 `environment` 传 ANTHROPIC_AUTH_TOKEN 等"。
- **BASE_DIR 错误**：根因"容器内 BASE_DIR=/opt/beijing-tutor 但实际 WORKDIR 是 /app"；修复"BASE_DIR=/app，知识库和 CLAUDE.md 才能正确加载"。
- 部署架构："Nginx 反向代理: 80 → 127.0.0.1:3000；API: DeepSeek v4-pro (Anthropic兼容端点)"。

> 注：memory 是 AI 的二手总结，** above 各问题已逐条用一手对话原文（用户输入 / AI 诊断 / 工具命令 / 工具返回）交叉验证**。唯一例外是问题 4（验证码），memory 里"验证码 Bug 修复"指向更早会话，本文件无一手排障细节。

---

## 一句话结论（按问题）

| # | 问题 | 本文件证据状态 | 根因 | 修复 |
|---|------|----------------|------|------|
| 1 | Docker volume | ✅ 完整 | 镜像 build 期 COPY web，运行期无挂载，scp 改宿主机文件不生效 | compose 加 `./web:/app` 并重建 |
| 2 | API Key 为空 | ✅ 完整 | `env_file` 没把 .env 灌进容器，`ANTHROPIC_AUTH_TOKEN=` 空 → DeepSeek 认证失败 | 改显式 `environment` 传参 |
| 3 | BASE_DIR 错误 | ✅ 完整 | .env 写 `/opt/beijing-tutor`，容器 WORKDIR 实为 `/app`，知识库找不到 | 三处同步改 `BASE_DIR=/app` |
| 4 | 登录验证码 | ⚠️ 未找到排障链条 | ——（仅机制描述 + 更早会话的"已修复"记录） | —— |
| 5 | 部署架构 | ✅ 完整 | Nginx 80→127.0.0.1:3000 + DeepSeek v4-pro Anthropic 兼容端点 | （架构事实，非修复项） |
