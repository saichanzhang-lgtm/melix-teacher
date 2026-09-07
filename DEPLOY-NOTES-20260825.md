# Melix Teacher 后端优化 — 部署说明

> 日期：2026-08-25
> 范围：Bug 修复 + 性能优化 + 后端逻辑调整

---

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `web/server.js` | 性能+安全 | gzip压缩、静态文件流式读取、智能缓存策略、body大小限制、请求超时、生产日志优化 |
| `web/lib/kb-loader.js` | 性能 | 知识库内存缓存 + 按agent缓存prompt，避免每次请求读7个文件 |
| `web/routes/chat.js` | 性能 | system prompt 缓存，避免每次正则提取 |
| `web/lib/ai-client.js` | 安全 | AI响应120秒超时，防止API挂起导致连接泄漏 |
| `web/routes/auth.js` | 性能 | 手机号→uid索引缓存，登录查找从O(n)降为O(1) |
| `web/routes/student.js` | Bug | 修复 `const protected` 保留字变量名 → `protectedFields` |
| `web/lib/storage.js` | 安全 | 原子写入（tmp+rename），防止写入中断导致数据损坏 |
| `.env` | Bug | 修复 BASE_DIR 路径（本地开发用） |

---

## 性能提升预估

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 每次chat请求读盘次数 | 7次同步读 | 0次（启动后全缓存） |
| system prompt构建 | 每次正则提取+拼接 | O(1)缓存命中 |
| 登录用户查找 | O(n)遍历目录 | O(1)索引查找 |
| HTML传输大小 | ~152KB（裸传） | ~35KB（gzip后） |
| vendor库缓存 | no-cache（每次重传） | 30天长期缓存 |
| 请求体上限 | 无限制（DoS风险） | 1MB |
| AI请求超时 | 无（永久挂起） | 120秒自动断开 |
| 数据写入安全性 | 直接覆盖（崩溃即损坏） | 原子写入 |

---

## 线上部署步骤（Docker）

```bash
# 1. SSH 登录服务器
ssh root@101.201.79.224

# 2. 备份当前版本
cd /opt/beijing-tutor
cp -r web web.backup-$(date +%Y%m%d-%H%M%S)

# 3. 上传修改后的文件（在本地执行，替换以下路径）
# scp web/server.js root@101.201.79.224:/opt/beijing-tutor/web/
# scp web/lib/kb-loader.js root@101.201.79.224:/opt/beijing-tutor/web/lib/
# scp web/routes/chat.js root@101.201.79.224:/opt/beijing-tutor/web/routes/
# scp web/routes/auth.js root@101.201.79.224:/opt/beijing-tutor/web/routes/
# scp web/routes/student.js root@101.201.79.224:/opt/beijing-tutor/web/routes/
# scp web/lib/ai-client.js root@101.201.79.224:/opt/beijing-tutor/web/lib/
# scp web/lib/storage.js root@101.201.79.224:/opt/beijing-tutor/web/lib/

# 4. 重启容器
docker compose -f /opt/beijing-tutor/docker-compose.yml restart

# 5. 验证
curl http://localhost:3000/api/health
# 期望返回: {"status":"ok","model":"deepseek-v4-pro"}

# 6. 查看日志确认无报错
docker compose -f /opt/beijing-tutor/docker-compose.yml logs --tail 30
```

---

## 回滚方案

```bash
cd /opt/beijing-tutor
# 恢复备份
rm -rf web
mv web.backup-YYYYMMDD-HHMMSS web
docker compose -f /opt/beijing-tutor/docker-compose.yml restart
```

---

## 注意事项

1. **线上 .env 无需修改** — 生产环境用 `deploy/aliyun/.env.production`，BASE_DIR=/opt/beijing-tutor 已正确
2. **前端 index.html 未修改** — 本次优化集中在后端，前端通过 gzip + 缓存策略自动受益
3. **知识库缓存是进程内的** — 重启服务后会重新加载，属正常行为
4. **AI超时120秒** — 正常生成不会超过此时间，超长试卷生成（100题分5批）每批独立计时
