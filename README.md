# Melix Teacher — AI Teaching Workspace

面向北京市 K12 英语教学的 AI 家教平台。单文件 SPA + Node.js 原生服务 + Docker 部署，接入 DeepSeek（Anthropic 兼容端点），内置北京考情数据库与教材知识库。

## 功能模块（V5.1）

| 模块 | 说明 |
|------|------|
| 📐 语法中心（默认入口） | 小学—高中全语法体系，知识点多选 → 概念精讲 + 北京考法 + 阶梯刷题 |
| 📋 智能组卷 | 单元/期中/期末/月考/小升初/中高考模拟，三版输出：试卷版 · 答案版 · 教师版 |
| ✍️ 作文中心 | 17 种作文类型，命题 / 模板 / 批改三种模式 |
| 📚 智能词汇检测 | 上传词表（Excel/Word/CSV）→ 浏览器端解析建库 → 语境化出题 → 错词本复习 |

所有生成内容支持一键导出 Word（自动剥离 AI 对话腔）。桌面端 + 移动端双端适配（移动端底部 4 Tab 布局）。

## 技术栈

- **前端**：单文件 SPA（`web/index.html`，无框架），localStorage 按 Agent 隔离会话
- **后端**：Node.js 原生 http 服务（`web/server.js`），SSE 流式响应，JWT 邀请码鉴权
- **解析库**：SheetJS + mammoth + pdf.js（自托管于 `web/lib/vendor/`，懒加载 + CDN 三级兜底）
- **部署**：Docker Compose + Nginx 反向代理，阿里云 ECS
- **模型**：DeepSeek（Anthropic 兼容协议），系统提示词 = 仓库根 `CLAUDE.md`

## 本地运行

```bash
cp .env.example .env   # 填入 API Key
npm install
npm start              # http://localhost:3000
```

## 部署

见 `deploy/aliyun/`（含 Dockerfile、docker-compose、nginx 参考配置、setup 脚本）。

```bash
docker compose up -d --build
# Nginx 反代 80 → 127.0.0.1:3000
```

> ⚠️ 生产 `CLAUDE.md` 通过 volume 挂载进容器，修改后需 `docker compose restart`；`web/` 目录整体挂载，静态文件 scp 后即生效。

## 目录结构

```
├── web/                  # 前端 + Node 服务
│   ├── index.html        # 单文件 SPA（桌面 + 移动端）
│   ├── server.js         # API 服务（/api/chat SSE、/api/auth、/api/user）
│   └── lib/vendor/       # 自托管解析库
├── references/           # 知识库：北京考情 / 教材 / 语法全景 / 组卷模板 / 题库
├── teaching-materials/   # 教材分析 + 设计 mockup
├── scripts/              # 组卷辅助脚本
├── deploy/aliyun/        # 生产部署配置
└── CLAUDE.md             # AI 系统提示词（6 个 Agent 定义 + 命题规范）
```

## 安全说明

- `.env`、`students/`（学生档案）、`exams/`（含学生姓名的试卷）已在 `.gitignore` 中排除，**永不入库**
- Nginx 层拦截 `*.md`/`*.env`/`*.bak-*`/隐藏文件及 `students|references|data` 目录的公网直连（返回 404）
