const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// ═══════════════════════════════════════
// 配置
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || 'sk-5185d6c27b904e64b0d4cae7ceaa8b08';
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';
const JWT_SECRET = process.env.JWT_SECRET || 'beijing-tutor-jwt-secret-v4';
const ENV = process.env.NODE_ENV || 'development';
const INVITE_MODE = process.env.INVITE_MODE === 'true';

// 加载系统 Prompt + 知识库
const BASE_DIR = process.env.BASE_DIR || path.join(__dirname, '..');
const CLAUDE_PATHS = [
  path.join(BASE_DIR, 'CLAUDE.md'),
  'D:/CLAUDE.md',
  path.join(__dirname, '..', 'CLAUDE.md'),
];
let SYSTEM_PROMPT = '';
for(const p of CLAUDE_PATHS){
  try{SYSTEM_PROMPT=fs.readFileSync(p,'utf-8');console.log('  ✅ 已加载 CLAUDE.md ('+p+')');break}catch(e){}
}
if(!SYSTEM_PROMPT){
  console.log('  ⚠️ CLAUDE.md 未找到，使用默认配置');
  SYSTEM_PROMPT='你是北京市K12英语AI教学专家。';
}

// 加载参考知识库文件
function loadKnowledgeBase(){
  const files={
    'textbook':'references/textbook-database.md',
    'grammar':'references/grammar-scope.md',
    'exam':'references/beijing-exam-system.md',
    'templates':'references/exam-templates.md'
  };
  let kb='\n\n---\n## 知识库内容（以下为真实教材和考试数据，优先参考）\n';
  for(const[key,relPath]of Object.entries(files)){
    try{
      const fullPath=path.join(BASE_DIR,relPath);
      const content=fs.readFileSync(fullPath,'utf-8');
      // Truncate very large files to prevent token overflow
      kb+='\n### '+key+'\n'+content.slice(0,12000)+'\n';
      console.log('  ✅ 已加载知识库: '+relPath+' ('+content.length+' 字)');
    }catch(e){
      console.log('  ⚠️ 知识库缺失: '+relPath);
    }
  }
  SYSTEM_PROMPT+=kb;
}
loadKnowledgeBase();

// ═══════════════════════════════════════
// Auth System
// ═══════════════════════════════════════
const DATA_DIR = path.join(BASE_DIR,'data');
const USERS_DIR = path.join(DATA_DIR,'users');
const INVITES_DIR = path.join(DATA_DIR,'invites');
[USERS_DIR,INVITES_DIR].forEach(d=>{try{fs.mkdirSync(d,{recursive:true})}catch(e){}});

function jwtSign(payload){const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const b=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+b).digest('base64url');return h+'.'+b+'.'+sig}
function jwtVerify(token){try{const[p,h,s]=token.split('.');const v=crypto.createHmac('sha256',JWT_SECRET).update(p+'.'+h).digest('base64url');if(v!==s)return null;const d=JSON.parse(Buffer.from(h,'base64url').toString());if(d.exp&&Date.now()>d.exp*1000)return null;return d}catch(e){return null}}
function uid(){return'u_'+crypto.randomBytes(12).toString('hex')}
function getAuthUser(req){
  const auth=req.headers['authorization']||'';
  const token=auth.replace('Bearer ','');
  if(!token)return null;
  const d=jwtVerify(token);
  if(!d||!d.uid)return null;
  return loadUser(d.uid);
}
function loadUser(uid){
  try{return JSON.parse(fs.readFileSync(USERS_DIR+'/'+uid+'.json','utf8'))}catch(e){return null}
}
function saveUser(user){fs.writeFileSync(USERS_DIR+'/'+user.uid+'.json',JSON.stringify(user,null,2))}
function createUser(phone){
  const user={uid:uid(),phone:phone,nickname:'教师'+phone.slice(-4),avatar:'',role:'teacher',status:'active',createdAt:new Date().toISOString(),lastLogin:new Date().toISOString(),inviteCode:'',workspace:{students:[],preferences:{}}};
  saveUser(user);return user;
}
function getUserDir(uid){const d=DATA_DIR+'/'+uid;try{fs.mkdirSync(d,{recursive:true})}catch(e){}return d}

// Verification codes (in-memory, TTL 5min)
const codeStore={};
function setCode(phone,code){codeStore[phone]={code:code,exp:Date.now()+300000}}
function verifyCode(phone,code){
  const c=codeStore[phone];
  if(!c||Date.now()>c.exp)return false;
  if(c.code!==code)return false;
  delete codeStore[phone];return true;
}

// Invite codes
function genInviteCode(){return 'BJ'+crypto.randomBytes(4).toString('hex').toUpperCase()}
function loadInvites(){try{return JSON.parse(fs.readFileSync(INVITES_DIR+'/codes.json','utf8'))}catch(e){return[]}}
function saveInvites(invites){fs.writeFileSync(INVITES_DIR+'/codes.json',JSON.stringify(invites,null,2))}

// Admin
function isAdmin(uid){const u=loadUser(uid);return u&&u.role==='admin'}
function adminStats(){
  let userCount=0,activeToday=0;
  try{userCount=fs.readdirSync(USERS_DIR).filter(f=>f.endsWith('.json')).length}catch(e){}
  return{userCount,activeToday,model:MODEL,kbLoaded:true,env:ENV,inviteMode:INVITE_MODE,timestamp:new Date().toISOString()};
}

// ═══════════════════════════════════════
// MIME 类型
// ═══════════════════════════════════════
const jsonH = { 'Content-Type': 'application/json; charset=utf-8' };
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
  const os = require('os');
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
// AI API 调用（流式）
// ═══════════════════════════════════════
async function callAI(messages, res) {
  const body = JSON.stringify({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: messages,
    max_tokens: 4096,
    stream: true,
  });

  return new Promise((resolve, reject) => {
    const fullUrl = API_BASE + '/v1/messages';
    const apiUrl = new URL(fullUrl);
    const isHttps = apiUrl.protocol === 'https:';
    const httpModule = isHttps ? require('https') : require('http');

    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (isHttps ? 443 : 80),
      path: apiUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream',
      },
    };

    const apiReq = httpModule.request(options, (apiRes) => {
      if (apiRes.statusCode !== 200) {
        let errBody = '';
        apiRes.on('data', c => { errBody += c; });
        apiRes.on('end', () => {
          let errMsg = `API Error ${apiRes.statusCode}`;
          try {
            const err = JSON.parse(errBody);
            errMsg = err.error?.message || errMsg;
          } catch (e) {}
          reject(new Error(errMsg));
        });
        return;
      }

      let buffer = '';
      let currentEvent = '';
      let streamEnded = false;

      apiRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content_block_delta') {
                const deltaType = parsed.delta?.type || '';
                if (deltaType === 'text_delta') {
                  const text = parsed.delta?.text || '';
                  res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
                }
              } else if (parsed.type === 'message_stop' && !streamEnded) {
                streamEnded = true;
                res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
              }
            } catch (e) {
              // skip parse errors in stream
            }
          }
        }
      });

      apiRes.on('end', () => {
        if (!streamEnded) {
          streamEnded = true;
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }
        res.end();
        resolve();
      });

      apiRes.on('error', reject);
    });

    apiReq.on('error', reject);
    apiReq.write(body);
    apiReq.end();
  });
}

// ═══════════════════════════════════════
// HTTP 服务器
// ═══════════════════════════════════════
const server = http.createServer(async (req, res) => {
  console.log('['+new Date().toISOString().slice(11,19)+']', req.method, req.url);
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  const pathname = parsedUrl.pathname;

  // ═══════ API 路由 ═══════
  if (pathname === '/api/chat' && req.method === 'POST') {
    try {
      const data = await parseBody(req);
      const messages = data.messages || [];

      if (!messages.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'messages required' }));
        return;
      }

      // 设置 SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await callAI(messages, res);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      } else {
        // SSE stream already started, send error event
        res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
        res.end();
      }
    }
    return;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', model: MODEL }));
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: MODEL, provider: API_BASE, env:ENV, inviteMode:INVITE_MODE }));
    return;
  }

  // ═══════ AUTH ═══════
  if (pathname === '/api/auth/send-code' && req.method === 'POST') {
    const data=await parseBody(req);const phone=data.phone||'';
    if(!/^1\d{10}$/.test(phone)){res.writeHead(400,jsonH);res.end(JSON.stringify({error:'手机号格式不正确'}));return}
    const code=ENV==='development'?'123456':String(Math.floor(100000+Math.random()*900000));
    setCode(phone,code);
    const devMsg=ENV==='development'?' (开发模式: '+code+')':'';
    console.log('📱 验证码 ['+phone+']: '+code+devMsg);
    res.writeHead(200,jsonH);res.end(JSON.stringify({success:true,message:'验证码: '+code+' (有效期5分钟，未配置短信服务，请在登录页输入此验证码)'}));
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const data=await parseBody(req);const phone=data.phone||'';const code=data.code||'';
    if(!verifyCode(phone,code)){res.writeHead(401,jsonH);res.end(JSON.stringify({error:'验证码错误或已过期'}));return}
    // Check invite mode
    if(INVITE_MODE){const invite=data.invite||'';const invites=loadInvites();const inv=invites.find(i=>i.code===invite&&i.used<i.maxUses);if(!inv){res.writeHead(403,jsonH);res.end(JSON.stringify({error:'邀请码无效或已用完'}));return}inv.used++;saveInvites(invites)}
    // Find or create user
    let user=null;
    try{const files=fs.readdirSync(USERS_DIR);for(const f of files){const u=JSON.parse(fs.readFileSync(USERS_DIR+'/'+f,'utf8'));if(u.phone===phone){user=u;break}}}catch(e){}
    if(!user)user=createUser(phone);
    user.lastLogin=new Date().toISOString();saveUser(user);
    // Issue JWT (30 days)
    const token=jwtSign({uid:user.uid,phone:user.phone,role:user.role,exp:Math.floor(Date.now()/1000)+2592000});
    getUserDir(user.uid); // ensure data dir
    res.writeHead(200,jsonH);res.end(JSON.stringify({token,user:{uid:user.uid,phone:user.phone,nickname:user.nickname,role:user.role,avatar:user.avatar}}));
    return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user=getAuthUser(req);
    if(!user){res.writeHead(401,jsonH);res.end(JSON.stringify({error:'请先登录'}));return}
    res.writeHead(200,jsonH);res.end(JSON.stringify({user:{uid:user.uid,phone:user.phone,nickname:user.nickname,role:user.role,avatar:user.avatar,workspace:user.workspace}}));
    return;
  }

  // ═══════ ADMIN ═══════
  if (pathname === '/api/admin/stats' && req.method === 'GET') {
    const user=getAuthUser(req);
    if(!user||!isAdmin(user.uid)){res.writeHead(403,jsonH);res.end(JSON.stringify({error:'需要管理员权限'}));return}
    res.writeHead(200,jsonH);res.end(JSON.stringify(adminStats()));
    return;
  }

  if (pathname === '/api/admin/invites' && req.method === 'GET') {
    const user=getAuthUser(req);
    if(!user||!isAdmin(user.uid)){res.writeHead(403,jsonH);res.end(JSON.stringify({error:'需要管理员权限'}));return}
    res.writeHead(200,jsonH);res.end(JSON.stringify(loadInvites()));
    return;
  }

  if (pathname === '/api/admin/invites' && req.method === 'POST') {
    const user=getAuthUser(req);
    if(!user||!isAdmin(user.uid)){res.writeHead(403,jsonH);res.end(JSON.stringify({error:'需要管理员权限'}));return}
    const data=await parseBody(req);const count=data.count||5;const maxUses=data.maxUses||1;
    const invites=loadInvites();
    for(let i=0;i<count;i++)invites.push({code:genInviteCode(),maxUses:maxUses,used:0,createdAt:new Date().toISOString()});
    saveInvites(invites);
    res.writeHead(200,jsonH);res.end(JSON.stringify({created:count,invites:invites.slice(-count)}));
    return;
  }

  // ═══════ USER DATA (isolated per uid) ═══════
  if (pathname === '/api/user/data' && req.method === 'GET') {
    const user=getAuthUser(req);
    if(!user){res.writeHead(401,jsonH);res.end(JSON.stringify({error:'请先登录'}));return}
    const dir=getUserDir(user.uid);const df=dir+'/tutor-data.json';
    try{const d=fs.readFileSync(df,'utf8');res.writeHead(200,jsonH);res.end(d)}catch(e){res.writeHead(200,jsonH);res.end('{}')}
    return;
  }
  if (pathname === '/api/user/data' && req.method === 'POST') {
    const user=getAuthUser(req);
    if(!user){res.writeHead(401,jsonH);res.end(JSON.stringify({error:'请先登录'}));return}
    const data=await parseBody(req);
    const dir=getUserDir(user.uid);
    fs.writeFileSync(dir+'/tutor-data.json',JSON.stringify(data,null,2));
    res.writeHead(200,jsonH);res.end(JSON.stringify({success:true}));
    return;
  }

  // ═══════ Auth-protected chat (future: per-user API keys) ═══════
  // For now, chat continues to work with the default API key

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
// 自动配置 Windows 防火墙（手机端访问）
// ═══════════════════════════════════════
function setupFirewall() {
  const { execSync } = require('child_process');
  try {
    // 先检查规则是否已存在
    execSync('netsh advfirewall firewall show rule name="BeijingEnglishTutor"', { stdio: 'ignore' });
    console.log('  ✅ 防火墙规则已存在');
  } catch (e) {
    // 规则不存在，尝试添加
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
// 启动
// ═══════════════════════════════════════
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
