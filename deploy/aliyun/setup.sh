#!/bin/bash
set -e
# ═══════════════════════════════════════════════════════
# 北京K12英语AI家教 — 阿里云一键部署脚本
# 适用: Ubuntu 22.04 / CentOS Stream 9
# ═══════════════════════════════════════════════════════

RED='\033[0;31m' GREEN='\033[0;32m' BLUE='\033[0;34m' NC='\033[0m'
log(){ echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${RED}[!]${NC} $1"; }
info(){ echo -e "${BLUE}[*]${NC} $1"; }

echo "╔══════════════════════════════════════════╗"
echo "║  🎓 北京K12英语AI家教 — 阿里云部署    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 检测系统 ──
if [ -f /etc/os-release ]; then . /etc/os-release; OS=$ID; else OS="unknown"; fi
log "检测到系统: $OS"

# ── 输入配置 ──
read -p "域名 (不填则使用IP): " DOMAIN
read -p "JWT密钥 (回车自动生成): " JWT_KEY
JWT_KEY=${JWT_KEY:-$(openssl rand -hex 32)}
read -p "AI API Key (回车使用默认): " AI_KEY
AI_KEY=${AI_KEY:-"sk-5185d6c27b904e64b0d4cae7ceaa8b08"}

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "unknown")
log "服务器公网IP: $PUBLIC_IP"

# ── 安装依赖 ──
info "安装 Docker + Nginx..."

if [ "$OS" = "ubuntu" ]; then
  apt-get update -qq
  apt-get install -y -qq nginx certbot python3-certbot-nginx curl 2>/dev/null
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | bash
  fi
elif [ "$OS" = "centos" ] || [ "$OS" = "\"centos\"" ]; then
  yum install -y epel-release nginx certbot python3-certbot-nginx curl 2>/dev/null
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | bash
  fi
  systemctl enable docker --now
fi

systemctl enable docker --now 2>/dev/null
systemctl enable nginx --now 2>/dev/null
log "Docker + Nginx 安装完成"

# ── 创建部署目录 ──
DEPLOY_DIR="/opt/beijing-tutor"
mkdir -p $DEPLOY_DIR/{web,references,data/users,data/invites,logs,nginx}
log "部署目录创建: $DEPLOY_DIR"

# ── 复制项目文件 ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# 如果是从本地传上来的部署包
if [ -f "$SCRIPT_DIR/Dockerfile" ]; then
  cp "$SCRIPT_DIR/Dockerfile" "$DEPLOY_DIR/"
  cp "$SCRIPT_DIR/docker-compose.yml" "$DEPLOY_DIR/"
  cp -r "$SCRIPT_DIR/../web" "$DEPLOY_DIR/" 2>/dev/null || true
fi

# 复制知识库
if [ -d "$PROJECT_DIR/references" ]; then
  cp -r "$PROJECT_DIR/references" "$DEPLOY_DIR/"
fi
if [ -f "$PROJECT_DIR/CLAUDE.md" ]; then
  cp "$PROJECT_DIR/CLAUDE.md" "$DEPLOY_DIR/"
fi
if [ -d "$PROJECT_DIR/web" ]; then
  cp -r "$PROJECT_DIR/web" "$DEPLOY_DIR/"
fi

log "项目文件复制完成"

# ── 生成 .env ──
cat > $DEPLOY_DIR/.env <<EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$JWT_KEY
ANTHROPIC_AUTH_TOKEN=$AI_KEY
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=deepseek-v4-pro
BASE_DIR=$DEPLOY_DIR
INVITE_MODE=false
DOMAIN=${DOMAIN:-$PUBLIC_IP}
EOF
log ".env 配置文件已生成"

# ── 创建 Dockerfile ──
cat > $DEPLOY_DIR/Dockerfile <<'DOCKEREOF'
FROM node:20-alpine
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
WORKDIR /app
COPY web/package*.json ./
RUN npm install --production 2>/dev/null || true
COPY web/ ./
COPY references/ /app/references/
COPY CLAUDE.md /app/
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
DOCKEREOF

# ── 创建 docker-compose.yml ──
cat > $DEPLOY_DIR/docker-compose.yml <<'COMPOSEEOF'
version: '3.8'
services:
  tutor:
    build: .
    container_name: beijing-tutor
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./references:/app/references
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)})"]
      interval: 30s
      timeout: 5s
      retries: 3
COMPOSEEOF

# ── 构建并启动 Docker ──
info "构建 Docker 镜像..."
cd $DEPLOY_DIR
docker-compose down --remove-orphans 2>/dev/null || true
docker-compose build --quiet
docker-compose up -d
log "Docker 容器已启动"

# ── 配置 Nginx ──
cat > /etc/nginx/sites-available/beijing-tutor <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    client_max_body_size 50m;

    # 登录页面 + 静态文件
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # SSE 流式响应优化
    location /api/chat {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    access_log /var/log/nginx/beijing-tutor-access.log;
    error_log /var/log/nginx/beijing-tutor-error.log;
}
NGINXEOF

# 启用站点
if [ -d /etc/nginx/sites-enabled ]; then
  ln -sf /etc/nginx/sites-available/beijing-tutor /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
elif [ -d /etc/nginx/conf.d ]; then
  cp /etc/nginx/sites-available/beijing-tutor /etc/nginx/conf.d/beijing-tutor.conf
fi

nginx -t && systemctl reload nginx
log "Nginx 配置完成"

# ── HTTPS (如果有域名) ──
if [ -n "$DOMAIN" ]; then
  info "申请 SSL 证书..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" 2>/dev/null || warn "SSL申请失败，可稍后手动执行: certbot --nginx -d $DOMAIN"
fi

# ── 阿里云防火墙(安全组)提示 ──
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  🎉 部署完成！                              ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  🌐 访问地址: http://$PUBLIC_IP               ║"
if [ -n "$DOMAIN" ]; then
  echo "║  🌐 域名:     https://$DOMAIN                 ║"
fi
echo "║  🔑 登录页:   http://$PUBLIC_IP/login.html    ║"
echo "║  🔐 验证码:   123456 (开发模式)              ║"
echo "║                                              ║"
echo "║  ⚠️  别忘了！                               ║"
echo "║  去阿里云控制台 → 安全组 → 开放 80/443 端口 ║"
echo "║  https://ecs.console.aliyun.com/#/securityGroup ║"
echo "║                                              ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  常用命令:                                   ║"
echo "║  docker-compose logs -f    # 查看日志        ║"
echo "║  docker-compose restart    # 重启服务        ║"
echo "║  docker-compose down       # 停止服务        ║"
echo "║  docker-compose up -d      # 启动服务        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── systemd 开机自启 ──
cat > /etc/systemd/system/beijing-tutor.service <<SYSTEMDEOF
[Unit]
Description=Beijing K12 English AI Tutor
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
StandardOutput=journal

[Install]
WantedBy=multi-user.target
SYSTEMDEOF

systemctl daemon-reload
systemctl enable beijing-tutor.service 2>/dev/null
log "systemd 开机自启已配置"

log "全部完成! 用手机流量访问 http://$PUBLIC_IP 测试"
