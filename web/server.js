// ═══════════════════════════════════════
// Melix Teacher — AI Teaching Workspace
// 模块化后端入口
// ═══════════════════════════════════════

// 加载 .env 文件（手动解析，零依赖）
(function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of envPaths) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      });
      console.log('  ✅ 已加载环境变量: ' + envPath);
      break;
    } catch (e) { /* continue */ }
  }
})();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

// 加载模块
const cors = require('./middleware/cors');
const { getAuthUser, isAdmin } = require('./middleware/auth');
const { handleChat } = require('./routes/chat');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');

// ═══════════════════════════════════════
// 配置
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';
const JSON_HEADER = { 'Content-Type': 'application/json; charset=utf-8' };
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const INVITE_MODE = process.env.INVITE_MODE === 'true';
const DATA_DIR = path.join(__dirname, '..', 'data');

// JWT_SECRET 强制校验（安全加固）
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  if (ENV === 'production') {
    console.error('❌ 致命错误: JWT_SECRET 环境变量未设置，生产环境必须配置');
    process.exit(1);
  }
  // 开发环境使用默认值（仅用于本地开发）
  process.env.JWT_SECRET = 'melix-dev-jwt-secret-do-not-use-in-production';
  console.warn('⚠️  开发模式: 使用默认 JWT_SECRET，生产环境请设置环境变量');
}

// ═══════════════════════════════════════
// MIME 类型
// ═══════════════════════════════════════
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════
function getIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// ═══════════════════════════════════════
// 自动配置 Windows 防火墙
// ═══════════════════════════════════════
function setupFirewall() {
  const { execSync } = require('child_process');
  try {
    execSync('netsh advfirewall firewall show rule name="BeijingEnglishTutor"', { stdio: 'ignore' });
    console.log('  ✅ 防火墙规则已存在');
  } catch (e) {
    try {
      execSync('netsh advfirewall firewall add rule name="BeijingEnglishTutor" dir=in action=allow protocol=TCP localport=' + PORT, { stdio: 'ignore' });
      console.log('  ✅ 防火墙规则已自动添加');
    } catch (e2) {
      console.log('  ⚠️  防火墙规则添加失败（需管理员权限）');
      console.log('  📱 手机端可能无法访问，请以管理员身份运行：');
      console.log('     D:\\beijing-english-tutor\\enable-firewall.bat');
    }
  }
}

// ═══════════════════════════════════════
// HTTP 服务器 — 路由注册
// ═══════════════════════════════════════
const server = http.createServer(async (req, res) => {
  console.log('[' + new Date().toISOString().slice(11, 19) + ']', req.method, req.url);

  // CORS
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // ═══════ API 路由 ═══════

  // AI Chat
  if (pathname === '/api/chat' && method === 'POST') {
    try {
      const data = await parseBody(req);
      await handleChat(req, res, data);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, JSON_HEADER);
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // Health
  if (pathname === '/api/health' && method === 'GET') {
    res.writeHead(200, JSON_HEADER);
    res.end(JSON.stringify({ status: 'ok', model: MODEL }));
    return;
  }

  // Config
  if (pathname === '/api/config' && method === 'GET') {
    res.writeHead(200, JSON_HEADER);
    res.end(JSON.stringify({ model: MODEL, provider: API_BASE, env: ENV, inviteMode: INVITE_MODE }));
    return;
  }

  // ═══════ AUTH ═══════
  if (pathname === '/api/auth/send-code' && method === 'POST') {
    const data = await parseBody(req).catch(() => ({}));
    await authRoutes.handleSendCode(req, res, data);
    return;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const data = await parseBody(req).catch(() => ({}));
    await authRoutes.handleLogin(req, res, data);
    return;
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    await authRoutes.handleMe(req, res, getAuthUser);
    return;
  }

  // ═══════ ADMIN ═══════
  if (pathname === '/api/admin/stats' && method === 'GET') {
    await adminRoutes.handleStats(req, res);
    return;
  }

  if (pathname === '/api/admin/invites') {
    if (method === 'GET') {
      await adminRoutes.handleGetInvites(req, res);
    } else if (method === 'POST') {
      const data = await parseBody(req).catch(() => ({}));
      await adminRoutes.handleCreateInvites(req, res, data);
    }
    return;
  }

  // ═══════ STUDENT API ═══════
  if (pathname === '/api/students' && method === 'GET') {
    await studentRoutes.handleListStudents(req, res);
    return;
  }

  if (pathname === '/api/students' && method === 'POST') {
    const data = await parseBody(req).catch(() => ({}));
    await studentRoutes.handleCreateStudent(req, res, data);
    return;
  }

  // /api/students/:id — 参数化路由
  const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch) {
    const studentId = studentMatch[1];
    if (method === 'GET') {
      await studentRoutes.handleGetStudent(req, res, studentId);
    } else if (method === 'PUT') {
      const data = await parseBody(req).catch(() => ({}));
      await studentRoutes.handleUpdateStudent(req, res, studentId, data);
    }
    return;
  }

  // /api/students/:id/sessions
  const sessionMatch = pathname.match(/^\/api\/students\/([^/]+)\/sessions$/);
  if (sessionMatch && method === 'POST') {
    const data = await parseBody(req).catch(() => ({}));
    await studentRoutes.handleAddSession(req, res, sessionMatch[1], data);
    return;
  }

  // /api/students/:id/progress
  const progressMatch = pathname.match(/^\/api\/students\/([^/]+)\/progress$/);
  if (progressMatch && method === 'GET') {
    await studentRoutes.handleGetProgress(req, res, progressMatch[1]);
    return;
  }

  // ═══════ USER DATA (isolated per uid) ═══════
  if (pathname === '/api/user/data') {
    const user = getAuthUser(req);
    if (!user) {
      res.writeHead(401, JSON_HEADER);
      res.end(JSON.stringify({ error: '请先登录' }));
      return;
    }

    if (method === 'GET') {
      try {
        const d = fs.readFileSync(path.join(DATA_DIR, user.uid, 'tutor-data.json'), 'utf8');
        res.writeHead(200, JSON_HEADER);
        res.end(d);
      } catch (e) {
        res.writeHead(200, JSON_HEADER);
        res.end('{}');
      }
      return;
    }

    if (method === 'POST') {
      const data = await parseBody(req).catch(() => ({}));
      const dir = path.join(DATA_DIR, user.uid);
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
      fs.writeFileSync(path.join(dir, 'tutor-data.json'), JSON.stringify(data, null, 2));
      res.writeHead(200, JSON_HEADER);
      res.end(JSON.stringify({ success: true }));
      return;
    }
  }

  // ═══════ 静态文件 ═══════
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // 安全检查：防止目录穿越
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveStatic(filePath, res);
});

// ═══════════════════════════════════════
// 启动
// ═══════════════════════════════════════

// 初始化默认学生数据（首次运行）
console.log('');
studentRoutes.initDefaultStudents();

server.listen(PORT, '0.0.0.0', () => {
  setupFirewall();
  const ips = getIPAddresses();
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  📚 Melix Teacher — AI Teaching Workspace   ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  💻 电脑访问:                               ║');
  console.log('║     http://localhost:' + PORT + '                  ║');
  console.log('║                                              ║');
  if (ips.length > 0) {
    console.log('║  📱 手机访问 (同WiFi):                      ║');
    ips.forEach(ip => {
      console.log('║     http://' + ip + ':' + PORT + '                          ║');
    });
    console.log('║                                              ║');
  }
  console.log('║  💡 手机打不开？                             ║');
  console.log('║  1. 确保手机和电脑连同一WiFi                 ║');
  console.log('║  2. 以管理员运行: enable-firewall.bat        ║');
  console.log('║  3. 或用浏览器打开上面的局域网地址           ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
