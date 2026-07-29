# 阿里云轻量应用服务器 — 一键部署指南

## 服务器配置建议

| 配置项 | 最低 | 推荐 |
|--------|------|------|
| CPU | 2核 | 2核+ |
| 内存 | 2GB | 4GB |
| 系统盘 | 50GB | 80GB |
| 带宽 | 3Mbps | 5Mbps |
| 系统 | Ubuntu 22.04 / CentOS Stream 9 |
| 价格 | ¥58/月 | ¥68-108/月 |

## 购买入口

1. 打开 https://swas.console.aliyun.com
2. 选择「轻量应用服务器」→「创建服务器」
3. 地域选离你最近的（北京/杭州）
4. 镜像选「系统镜像」→ Ubuntu 22.04
5. 购买完成后获取：**公网IP + root密码**

## 快速开始（5分钟上线）

```bash
# 1. SSH 登录服务器
ssh root@你的公网IP

# 2. 把本地的 deploy/aliyun/ 整个文件夹上传到服务器
#    在本地执行：
scp -r D:/beijing-english-tutor/deploy/aliyun root@你的公网IP:/root/

# 3. 在服务器上执行一键部署
cd /root/aliyun
chmod +x setup.sh
./setup.sh

# 4. 等待 3 分钟，访问 http://你的公网IP
```

## 域名绑定（可选）

1. 在阿里云 DNS 解析添加 A 记录 → 指向服务器 IP
2. 在 setup.sh 执行时输入域名，自动配置 HTTPS

## 目录结构

```
/opt/beijing-tutor/        # 部署目录
├── web/                   # 前端 + 服务
├── references/            # 知识库
├── CLAUDE.md             # Agent 配置
├── data/                  # 用户数据（自动备份）
├── logs/                  # 日志
└── docker-compose.yml    # 容器编排

/etc/nginx/sites-enabled/  # Nginx 配置
/etc/systemd/system/       # 系统服务（开机自启）
```
