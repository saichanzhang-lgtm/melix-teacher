FROM node:20-alpine

# 设置时区为北京时间
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

WORKDIR /app

# 复制依赖文件
COPY web/package*.json ./
RUN npm install --production --registry=https://registry.npmmirror.com 2>/dev/null || \
    npm install --production 2>/dev/null || true

# 复制应用代码
COPY web/ ./
COPY references/ /app/references/
COPY CLAUDE.md /app/

# 创建数据目录
RUN mkdir -p /app/data/users /app/data/invites /app/logs

ENV PORT=3000
ENV NODE_ENV=production
ENV BASE_DIR=/app

EXPOSE 3000

# 非root用户运行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "server.js"]
