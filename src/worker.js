// ═══════════════════════════════════════════════════════
// Melix Teacher — Cloudflare Worker
// 从阿里云 Docker (web/server.js) 完整移植：
//   静态资源 → CF 边缘缓存（assets，免费不限量）
//   API     → Worker（免费 10 万请求/天）
//   文件存储 → KV（users / students / invites / 学档 / 验证码）
// 前端 index.html 零改动。
// ═══════════════════════════════════════════════════════

import CLAUDE_PROMPT from './kb/claude-prompt.md';
import KB_TEXTBOOK from './kb/textbook-database.md';
import KB_GRAMMAR from './kb/grammar-scope.md';
import KB_EXAM from './kb/beijing-exam-system.md';
import KB_TEMPLATES from './kb/exam-templates.md';
import KB_VOCAB from './kb/vocabulary-bank.txt';
import KB_QUESTIONS from './kb/exam-questions.txt';
import KB_WRITING from './kb/writing-bank.txt';

// ═══════════════════════════════════════
// 配置
// ═══════════════════════════════════════
const JSON_H = { 'Content-Type': 'application/json; charset=utf-8' };
const MODEL_FALLBACK = 'deepseek-v4-pro';

// ═══════════════════════════════════════
// 系统提示词 + 知识库（启动时内置，移植 kb-loader.js）
// ═══════════════════════════════════════
const KB_FILES = [
  { key: 'textbook',   priority: 1, content: KB_TEXTBOOK },
  { key: 'grammar',    priority: 2, content: KB_GRAMMAR },
  { key: 'exam',       priority: 3, content: KB_EXAM },
  { key: 'templates',  priority: 4, content: KB_TEMPLATES },
  { key: 'vocabulary', priority: 5, content: KB_VOCAB },
  { key: 'questions',  priority: 6, content: KB_QUESTIONS },
  { key: 'writing',    priority: 7, content: KB_WRITING },
];
const DEFAULT_CHAR_BUDGET = 48000; // ~16K tokens

function buildKbText(agentFilter) {
  const sorted = [...KB_FILES].sort((a, b) => a.priority - b.priority);
  const weights = sorted.map((_, i) => sorted.length - i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let kbText = '\n\n---\n## 知识库内容（以下为真实教材和考试数据，优先参考）\n';
  let remainingBudget = DEFAULT_CHAR_BUDGET;
  sorted.forEach((entry, i) => {
    const quota = Math.floor(DEFAULT_CHAR_BUDGET * weights[i] / totalWeight);
    const useChars = Math.min(entry.content.length, quota, remainingBudget);
    if (useChars <= 0) return;
    let content = entry.content.slice(0, useChars);
    if (useChars < entry.content.length) {
      const lastHeader = content.lastIndexOf('\n## ');
      if (lastHeader > useChars * 0.6) content = content.slice(0, lastHeader);
    }
    kbText += '\n### ' + entry.key + '\n' + content + '\n';
    remainingBudget -= useChars;
  });
  return kbText;
}

// Agent 过滤（移植 routes/chat.js）
const AGENT_MAP = {
  teaching: '教材智能教学系统',
  grammar: '语法中心',
  exam: '智能组卷系统',
  grade: '智能阅卷系统',
  writing: '作文中心',
  vocabulary: '智能词汇检测中心',
};

function extractAgentSection(fullPrompt, agentName) {
  const label = AGENT_MAP[agentName];
  if (!label) return '';
  const pattern = new RegExp(
    '(# AGENT \\d+ [—\\-].*?' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?)(?=\n# AGENT \\d+ |\n# ULTIMATE GOAL|\n# OUTPUT REQUIREMENTS|$)',
    'i'
  );
  const m = fullPrompt.match(pattern);
  return m ? m[1] : '';
}

function extractPublicSections(p) {
  const parts = [];
  const roleMatch = p.match(/(# ROLE[\s\S]*?)(?=\n# GLOBAL RULES)/);
  if (roleMatch) parts.push(roleMatch[1]);
  const rulesMatch = p.match(/(# GLOBAL RULES[\s\S]*?)(?=\n# AGENT 1)/);
  if (rulesMatch) parts.push(rulesMatch[1]);
  const outputMatch = p.match(/(# OUTPUT REQUIREMENTS[\s\S]*?)(?=\n# 学生档案|───|$)/);
  if (outputMatch) parts.push(outputMatch[1]);
  const goalMatch = p.match(/(# ULTIMATE GOAL[\s\S]*)/);
  if (goalMatch) parts.push(goalMatch[1]);
  return parts.join('\n\n') || p;
}

// 按 agent 缓存最终 prompt（isolate 内 O(1)）
const _promptCache = {};
function buildSystemPrompt(agentFilter) {
  const cacheKey = agentFilter || '_default';
  if (_promptCache[cacheKey]) return _promptCache[cacheKey];
  let prompt = CLAUDE_PROMPT;
  if (agentFilter) {
    const agentSection = extractAgentSection(prompt, agentFilter);
    if (agentSection) prompt = extractPublicSections(prompt) + '\n\n' + agentSection;
  }
  prompt += buildKbText(agentFilter);
  _promptCache[cacheKey] = prompt;
  return prompt;
}

// ═══════════════════════════════════════
// JWT — HMAC-SHA256（Web Crypto）
// ═══════════════════════════════════════
const te = new TextEncoder();

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, te.encode(data)));
}
async function jwtSign(payload, secret) {
  const h = b64url(te.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const b = b64url(te.encode(JSON.stringify(payload)));
  return h + '.' + b + '.' + (await hmac(secret, h + '.' + b));
}
async function jwtVerify(token, secret) {
  try {
    const [p, b, s] = token.split('.');
    if (!p || !b || !s) return null;
    if ((await hmac(secret, p + '.' + b)) !== s) return null;
    const payload = JSON.parse(b64urlDecode(b));
    if (payload.exp && Date.now() > payload.exp * 1000) return null;
    return payload;
  } catch (e) { return null; }
}

function uid() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'u_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
function genInviteCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return 'BJ' + [...bytes].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

// ═══════════════════════════════════════
// KV 存储层（替代文件系统）
//   user:<uid>      → 用户 JSON
//   phone:<phone>   → uid（登录 O(1) 查找）
//   code:<phone>    → 验证码（TTL 300s，跨 isolate 可靠）
//   invites         → 邀请码数组
//   student:<id>    → 学生档案
//   udata:<uid>     → 个人工作区数据
// ═══════════════════════════════════════
async function loadUser(env, id) { return env.KV.get('user:' + id, 'json'); }
async function saveUser(env, user) {
  await env.KV.put('user:' + user.uid, JSON.stringify(user));
  await env.KV.put('phone:' + user.phone, user.uid);
}
function createUser(phone) {
  return {
    uid: uid(), phone, nickname: '教师' + phone.slice(-4),
    avatar: '', role: 'teacher', status: 'active',
    createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
    inviteCode: '', workspace: { students: [], preferences: {} }
  };
}
async function getInvites(env) { return (await env.KV.get('invites', 'json')) || []; }
async function saveInvites(env, invites) { await env.KV.put('invites', JSON.stringify(invites)); }
async function findStudent(env, id) { return env.KV.get('student:' + id, 'json'); }
async function saveStudentKV(env, student) { await env.KV.put('student:' + student.id, JSON.stringify(student)); }

async function getAuthUser(env, req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  const d = await jwtVerify(token, env.JWT_SECRET);
  if (!d || !d.uid) return null;
  return loadUser(env, d.uid);
}
function isAdminUser(u) { return u && u.role === 'admin'; }

// 验证码：KV + TTL（替代进程内存，多 isolate 下登录必成功）
async function setCode(env, phone, code) {
  await env.KV.put('code:' + phone, code, { expirationTtl: 300 });
}
async function verifyCode(env, phone, code) {
  const saved = await env.KV.get('code:' + phone);
  if (!saved || saved !== code) return false;
  await env.KV.delete('code:' + phone);
  return true;
}

// ═══════════════════════════════════════
// 速率限制（进程内内存，移植 middleware/rate-limit.js）
// ═══════════════════════════════════════
const WINDOW_MS = 60 * 1000;
// 🐛 词汇批量出题每 20 题一次请求 + 各板块连续出题，10次/分会误伤正常使用 → 429「请求过于频繁」
const MAX_REQUESTS = 30;
const _buckets = {};
function rateLimitChat(req) {
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const key = ip + '|' + token.slice(0, 20);
  const now = Date.now();
  if (!_buckets[key]) _buckets[key] = [];
  _buckets[key] = _buckets[key].filter(ts => now - ts < WINDOW_MS);
  if (_buckets[key].length >= MAX_REQUESTS) {
    return { status: 429, message: '请求过于频繁，请稍等一分钟再试' };
  }
  _buckets[key].push(now);
  return null;
}

// ═══════════════════════════════════════
// AI 调用（SSE 流式 + 重试 + 降级，移植 lib/ai-client.js）
// ═══════════════════════════════════════
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];
const CONNECT_TIMEOUT = 45000; // 🐛 首字节超时45s（原120s：模型排队时用户要干等2分钟×3次重试）
const IDLE_TIMEOUT = 120000;   // 流式开始后，120秒无数据即断开
// 🐛 deepseek-v4-pro 是思考模型，reasoning token 计入 max_tokens：
//   4096 会被复杂出题任务的思考耗尽 → 正文为空 =「出题没反应」。8192 保证思考后仍有正文空间。
const MAX_TOKENS = 8192;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 🐛 思考控制：deepseek-v4-pro 默认深度思考（实测一次出题 1192 个 thinking 增量，30s-2min）。
//   实测 thinking:{type:'disabled'} 同模型同题 12s→2s；budget_tokens 是「最少思考量」下限（会拖慢）。
//   ANTHROPIC_THINKING: disabled（默认，快）/ enabled（配合 BUDGET）/ auto（不传参，模型自行决定）
function buildRequestBody(p, systemPrompt, messages, model) {
  const body = { model, system: systemPrompt, messages, max_tokens: MAX_TOKENS, stream: true };
  const mode = p.thinking || 'disabled';
  if (mode === 'disabled') {
    body.thinking = { type: 'disabled' };
  } else if (mode === 'enabled') {
    body.thinking = { type: 'enabled', budget_tokens: parseInt(p.budget || '4096', 10) || 4096 };
  }
  return body;
}

async function streamOnce(p, systemPrompt, messages, model, sse) {
  // sse.started：一旦有内容写给客户端，外层 callAI 不再重试（否则会重复输出）
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), CONNECT_TIMEOUT);
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), IDLE_TIMEOUT);
  };

  const resp = await fetch(p.baseUrl + '/v1/messages', {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': p.token,
      'anthropic-version': '2023-06-01',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(buildRequestBody(p, systemPrompt, messages, model)),
  });

  if (resp.status !== 200) {
    clearTimeout(timer);
    const errBody = await resp.text();
    let msg = 'API Error ' + resp.status;
    try { msg = JSON.parse(errBody).error?.message || msg; } catch (e) {}
    const err = new Error(msg);
    err.statusCode = resp.status;
    throw err;
  }

  // 🐛 上游已接受请求 → 立即告知前端「已连接」，长思考时用户不再干等
  await sse.write({ type: 'status', text: '模型已连接，正在生成…' });

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buffer = '', streamEnded = false, gotText = false;

  try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    resetTimer(); // 首字节到达后切换为空闲超时
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta') {
          const dType = parsed.delta?.type || '';
          if (dType === 'text_delta') {
            gotText = true;
            sse.started = true;
            await sse.write({ type: 'text', text: parsed.delta?.text || '' });
          } else if (dType === 'thinking_delta') {
            // 🐛 思考模型的推理过程原被丢弃 → 出题时前端 1 分钟零反馈。
            //   现转发为 thinking 事件，前端显示「深度思考中…」进度。
            await sse.write({ type: 'thinking', text: parsed.delta?.thinking || '' });
          }
        } else if (parsed.type === 'message_stop' && !streamEnded) {
          streamEnded = true;
          const usage = parsed.usage || parsed.message?.usage || null;
          const doneMsg = { type: 'done' };
          if (usage) doneMsg.usage = usage;
          await sse.write(doneMsg);
        } else if (parsed.type === 'message' && !streamEnded) {
          // 非流式响应兜底
          streamEnded = true;
          const text = (parsed.content || []).map(c => c.text || '').join('');
          if (text) await sse.write({ type: 'text', text });
          const doneMsg = { type: 'done' };
          if (parsed.usage) doneMsg.usage = parsed.usage;
          await sse.write(doneMsg);
        }
      } catch (e) { /* 流内解析错误跳过 */ }
    }
  }
  } finally { clearTimeout(timer); }
  // 🐛 流正常结束但零正文（上游截断/异常）：不写 done，抛可重试错误让外层 callAI 自动重试
  //   （此前只发过 status/thinking 非内容事件，重试不会造成内容重复）
  if (!gotText) {
    const err = new Error('上游返回空内容');
    err.statusCode = 0; // 可重试
    throw err;
  }
  if (!streamEnded) await sse.write({ type: 'done' });
  await sse.end();
}

// 🐛 双供应商故障切换：主力（DeepSeek）402 余额不足/403 鉴权失败时自动切备用（智谱 GLM，同为
//   Anthropic 兼容端点，协议零改动）。充值 DeepSeek 后无需改代码，主力自动恢复。
function providerChain(env) {
  const chain = [{
    name: 'primary',
    baseUrl: env.ANTHROPIC_BASE_URL,
    token: env.ANTHROPIC_AUTH_TOKEN,
    model: env.ANTHROPIC_MODEL || MODEL_FALLBACK,
    thinking: env.ANTHROPIC_THINKING || 'disabled',
    budget: env.ANTHROPIC_THINKING_BUDGET,
  }];
  if (env.ANTHROPIC_BACKUP_BASE_URL && env.ANTHROPIC_BACKUP_AUTH_TOKEN) {
    chain.push({
      name: 'backup',
      baseUrl: env.ANTHROPIC_BACKUP_BASE_URL,
      token: env.ANTHROPIC_BACKUP_AUTH_TOKEN,
      model: env.ANTHROPIC_BACKUP_MODEL || 'glm-5.3-flash',
      thinking: env.ANTHROPIC_BACKUP_THINKING || 'disabled',
      budget: env.ANTHROPIC_BACKUP_THINKING_BUDGET,
    });
  }
  return chain;
}

async function callAI(env, systemPrompt, messages, sse) {
  const chain = providerChain(env);
  let lastError = null;
  for (const p of chain) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1] || 3000);
      try {
        await streamOnce(p, systemPrompt, messages, p.model, sse);
        return;
      } catch (e) {
        lastError = e;
        // 已经向客户端输出过内容 → 不能重试（会重复），直接中断
        if (sse.started) throw e;
        const status = e.statusCode || 0;
        console.log('[callAI] provider=' + p.name + ' status=' + status + ' err=' + (e.message || '').slice(0, 120));
        // 402 余额不足 / 403 鉴权失败：本家重试无意义 → 立即换下一家
        if (status === 402 || status === 403) break;
        const retryable = status === 429 || status >= 500 || status === 0; // 0=网络错误/超时/空回复
        if (!retryable) break; // 其它 4xx → 换下一家试试
      }
    }
  }
  throw lastError;
}

// SSE 写入器（app 自有格式：data: {"type":"text"|"done"|"error"}）
function makeSSE(ctrl) {
  const enc = new TextEncoder();
  return {
    write(obj) { return ctrl.enqueue(enc.encode('data: ' + JSON.stringify(obj) + '\n\n')); },
    end() { return ctrl.close(); },
    error(msg) {
      try { ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'error', error: msg }) + '\n\n')); ctrl.close(); } catch (e) {}
    },
  };
}

// ═══════════════════════════════════════
// 请求体解析
// ═══════════════════════════════════════
async function parseBody(req) {
  try {
    const text = await req.text();
    if (text.length > 1024 * 1024) throw new Error('body too large'); // 1MB 限制
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return {};
  }
}

// ═══════════════════════════════════════
// 主路由
// ═══════════════════════════════════════
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // CORS（与线上行为一致）
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      // ═══════ AI 聊天（SSE）═══════
      if (pathname === '/api/chat' && method === 'POST') {
        // 🔒 鉴权：公网可达，防止 API Key 被盗刷
        const chatUser = await getAuthUser(env, req);
        if (!chatUser) return json({ error: '请先登录' }, 401, cors);
        const body = await parseBody(req);
        const messages = body.messages || [];
        if (!Array.isArray(messages) || messages.length === 0) {
          return json({ error: 'messages required (non-empty array)' }, 400, cors);
        }
        const totalChars = messages.reduce((s, m) => s + (m.content || '').length, 0);
        if (totalChars > 100000) {
          return json({ error: '消息总长度超过限制' }, 400, cors);
        }
        const rl = rateLimitChat(req);
        if (rl) return json({ error: rl.message }, rl.status, cors);

        const systemPrompt = buildSystemPrompt(body.agent || '');
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const sse = {
          write: obj => writer.write(new TextEncoder().encode('data: ' + JSON.stringify(obj) + '\n\n')),
          end: () => writer.close(),
        };
        // 先返回 SSE 头，流在后台写入
        const resp = new Response(readable, {
          headers: {
            ...cors,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
        callAI(env, systemPrompt, messages, sse).catch(e => {
          try {
            writer.write(new TextEncoder().encode('data: ' + JSON.stringify({ type: 'error', error: e.message }) + '\n\n'));
            writer.close();
          } catch (err) {}
        });
        return resp;
      }

      // ═══════ 健康检查 / 配置 ═══════
      if (pathname === '/api/health' && method === 'GET') {
        return json({ status: 'ok', model: env.ANTHROPIC_MODEL || MODEL_FALLBACK, platform: 'cloudflare' }, 200, cors);
      }
      if (pathname === '/api/config' && method === 'GET') {
        return json({
          model: env.ANTHROPIC_MODEL || MODEL_FALLBACK,
          provider: env.ANTHROPIC_BASE_URL,
          env: env.NODE_ENV,
          inviteMode: env.INVITE_MODE === 'true',
          // 备用供应商状态（不暴露 key，只暴露是否配置）
          backupConfigured: !!(env.ANTHROPIC_BACKUP_BASE_URL && env.ANTHROPIC_BACKUP_AUTH_TOKEN),
          backupProvider: env.ANTHROPIC_BACKUP_BASE_URL || null,
          backupModel: env.ANTHROPIC_BACKUP_MODEL || null,
        }, 200, cors);
      }

      // ═══════ 认证 ═══════
      if (pathname === '/api/auth/send-code' && method === 'POST') {
        const data = await parseBody(req);
        const phone = data.phone || '';
        if (!/^1\d{10}$/.test(phone)) return json({ error: '手机号格式不正确' }, 400, cors);
        const code = String(Math.floor(100000 + Math.random() * 900000));
        await setCode(env, phone, code);
        console.log('验证码 [' + phone + ']: ' + code);
        return json({
          success: true,
          message: '验证码: ' + code + ' (有效期5分钟，未配置短信服务，请在登录页输入此验证码)'
        }, 200, cors);
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const data = await parseBody(req);
        const phone = data.phone || '';
        const code = data.code || '';
        if (!(await verifyCode(env, phone, code))) {
          return json({ error: '验证码错误或已过期' }, 401, cors);
        }
        // 邀请码模式
        if (env.INVITE_MODE === 'true') {
          const invite = data.invite || '';
          const invites = await getInvites(env);
          const inv = invites.find(i => i.code === invite && i.used < i.maxUses);
          if (!inv) return json({ error: '邀请码无效或已用完' }, 403, cors);
          inv.used++;
          await saveInvites(env, invites);
        }
        // 查找或创建用户
        let user = await loadUser(env, await env.KV.get('phone:' + phone));
        if (!user) user = createUser(phone);
        user.lastLogin = new Date().toISOString();
        await saveUser(env, user);
        // 签发 JWT（30天）
        const token = await jwtSign({
          uid: user.uid, phone: user.phone, role: user.role,
          exp: Math.floor(Date.now() / 1000) + 2592000
        }, env.JWT_SECRET);
        return json({
          token,
          user: { uid: user.uid, phone: user.phone, nickname: user.nickname, role: user.role, avatar: user.avatar }
        }, 200, cors);
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = await getAuthUser(env, req);
        if (!user) return json({ error: '请先登录' }, 401, cors);
        return json({
          user: {
            uid: user.uid, phone: user.phone, nickname: user.nickname,
            role: user.role, avatar: user.avatar, workspace: user.workspace
          }
        }, 200, cors);
      }

      // ═══════ 管理后台 ═══════
      if (pathname === '/api/admin/stats' && method === 'GET') {
        const user = await getAuthUser(env, req);
        if (!isAdminUser(user)) return json({ error: '需要管理员权限' }, 403, cors);
        let userCount = 0;
        const keys = await env.KV.list({ prefix: 'user:' });
        userCount = keys.keys.length;
        return json({
          userCount, activeToday: 0,
          model: env.ANTHROPIC_MODEL || MODEL_FALLBACK,
          kbLoaded: true, env: env.NODE_ENV,
          inviteMode: env.INVITE_MODE === 'true',
          timestamp: new Date().toISOString(),
        }, 200, cors);
      }

      if (pathname === '/api/admin/invites' && method === 'GET') {
        const user = await getAuthUser(env, req);
        if (!isAdminUser(user)) return json({ error: '需要管理员权限' }, 403, cors);
        return json(await getInvites(env), 200, cors);
      }

      if (pathname === '/api/admin/invites' && method === 'POST') {
        const user = await getAuthUser(env, req);
        if (!isAdminUser(user)) return json({ error: '需要管理员权限' }, 403, cors);
        const data = await parseBody(req);
        const count = data.count || 5, maxUses = data.maxUses || 1;
        const invites = await getInvites(env);
        for (let i = 0; i < count; i++) {
          invites.push({ code: genInviteCode(), maxUses, used: 0, createdAt: new Date().toISOString() });
        }
        await saveInvites(env, invites);
        return json({ created: count, invites: invites.slice(-count) }, 200, cors);
      }

      // ═══════ 学生档案 ═══════
      if (pathname === '/api/students' && method === 'GET') {
        // 🔒 学生隐私数据需登录
        const stuUser = await getAuthUser(env, req);
        if (!stuUser) return json({ error: '请先登录' }, 401, cors);
        const list = await env.KV.list({ prefix: 'student:' });
        const summary = [];
        for (const k of list.keys) {
          const s = await env.KV.get(k.name, 'json');
          if (!s) continue;
          summary.push({
            id: s.id, name: s.name, avatar: s.avatar, school: s.school,
            district: s.district, grade: s.grade, stage: s.stage,
            currentScore: s.currentScore, targetScore: s.targetScore,
            sessionCount: (s.sessions || []).length, updatedAt: s.updatedAt,
          });
        }
        return json(summary, 200, cors);
      }

      if (pathname === '/api/students' && method === 'POST') {
        const user = await getAuthUser(env, req);
        if (!user) return json({ error: '请先登录' }, 401, cors);
        const data = await parseBody(req);
        if (!data.id || !data.name) return json({ error: 'id 和 name 是必填字段' }, 400, cors);
        if (await findStudent(env, data.id)) return json({ error: '学生ID已存在: ' + data.id }, 409, cors);
        const student = {
          id: data.id, name: data.name, avatar: data.avatar || '👤',
          school: data.school || '', district: data.district || '',
          grade: data.grade || '', stage: data.stage || '',
          textbook: data.textbook || {}, targetExam: data.targetExam || '',
          currentScore: data.currentScore || 0, targetScore: data.targetScore || 100,
          weaknesses: data.weaknesses || [], strengths: data.strengths || [],
          sessions: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await saveStudentKV(env, student);
        return json(student, 201, cors);
      }

      let m = pathname.match(/^\/api\/students\/([^/]+)$/);
      if (m) {
        const studentId = decodeURIComponent(m[1]);
        if (method === 'GET') {
          const stuUser = await getAuthUser(env, req);
          if (!stuUser) return json({ error: '请先登录' }, 401, cors);
          const student = await findStudent(env, studentId);
          if (!student) return json({ error: '学生不存在: ' + studentId }, 404, cors);
          return json(student, 200, cors);
        }
        if (method === 'PUT') {
          const user = await getAuthUser(env, req);
          if (!user) return json({ error: '请先登录' }, 401, cors);
          const student = await findStudent(env, studentId);
          if (!student) return json({ error: '学生不存在: ' + studentId }, 404, cors);
          const data = await parseBody(req);
          const protectedFields = ['id', 'createdAt'];
          for (const [k, v] of Object.entries(data)) {
            if (protectedFields.includes(k)) continue;
            student[k] = v;
          }
          student.updatedAt = new Date().toISOString();
          await saveStudentKV(env, student);
          return json(student, 200, cors);
        }
      }

      m = pathname.match(/^\/api\/students\/([^/]+)\/sessions$/);
      if (m && method === 'POST') {
        const user = await getAuthUser(env, req);
        if (!user) return json({ error: '请先登录' }, 401, cors);
        const studentId = decodeURIComponent(m[1]);
        const student = await findStudent(env, studentId);
        if (!student) return json({ error: '学生不存在: ' + studentId }, 404, cors);
        const data = await parseBody(req);
        const session = {
          date: new Date().toISOString().slice(0, 10),
          agent: data.agent || 'teaching',
          summary: data.summary || '学习会话',
          duration: data.duration || 30,
          topics: data.topics || [],
          notes: data.notes || '',
        };
        if (!student.sessions) student.sessions = [];
        student.sessions.unshift(session);
        student.updatedAt = new Date().toISOString();
        if (Array.isArray(data.newWeaknesses)) {
          const existing = new Set(student.weaknesses || []);
          data.newWeaknesses.forEach(w => existing.add(w));
          student.weaknesses = [...existing];
        }
        await saveStudentKV(env, student);
        return json({ success: true, session, student }, 200, cors);
      }

      m = pathname.match(/^\/api\/students\/([^/]+)\/progress$/);
      if (m && method === 'GET') {
        const stuUser = await getAuthUser(env, req);
        if (!stuUser) return json({ error: '请先登录' }, 401, cors);
        const studentId = decodeURIComponent(m[1]);
        const student = await findStudent(env, studentId);
        if (!student) return json({ error: '学生不存在: ' + studentId }, 404, cors);
        const sessions = student.sessions || [];
        const totalSessions = sessions.length;
        const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const agentStats = {}, monthlyStats = {};
        sessions.forEach(s => {
          const a = s.agent || 'unknown';
          agentStats[a] = (agentStats[a] || 0) + 1;
          const mo = s.date ? s.date.slice(0, 7) : 'unknown';
          monthlyStats[mo] = (monthlyStats[mo] || 0) + 1;
        });
        return json({
          student: {
            id: student.id, name: student.name, grade: student.grade,
            currentScore: student.currentScore, targetScore: student.targetScore,
          },
          summary: {
            totalSessions, totalMinutes,
            firstSession: sessions.length > 0 ? sessions[sessions.length - 1].date : null,
            lastSession: sessions.length > 0 ? sessions[0].date : null,
          },
          weaknesses: student.weaknesses || [],
          strengths: student.strengths || [],
          agentDistribution: agentStats,
          monthlyActivity: monthlyStats,
          recentSessions: sessions.slice(0, 10),
        }, 200, cors);
      }

      // ═══════ 个人工作区数据 ═══════
      if (pathname === '/api/user/data' && method === 'GET') {
        const user = await getAuthUser(env, req);
        if (!user) return json({ error: '请先登录' }, 401, cors);
        const d = await env.KV.get('udata:' + user.uid);
        return new Response(d || '{}', { headers: JSON_H });
      }
      if (pathname === '/api/user/data' && method === 'POST') {
        const user = await getAuthUser(env, req);
        if (!user) return json({ error: '请先登录' }, 401, cors);
        const text = await req.text();
        if (text.length > 1024 * 1024) return json({ error: '数据超过1MB限制' }, 413, cors);
        try { JSON.parse(text); } catch (e) { return json({ error: 'Invalid JSON' }, 400, cors); }
        await env.KV.put('udata:' + user.uid, text);
        return json({ success: true }, 200, cors);
      }

      // ═══════ 非 API 路径 → 静态资源兜底 ═══════
      // （安全防护：md/env/bak/隐藏文件/敏感目录不在 public 内，天然 404；
      //   这里再拦截一次以防未来误放入静态目录）
      if (/\.(md|env)$/.test(pathname) || /\.bak-/.test(pathname) ||
          /^\/(students|references|data)(\/|$)/.test(pathname) || /\/\./.test(pathname)) {
        return new Response('Not Found', { status: 404 });
      }
      const asset = await env.ASSETS.fetch(req);
      if (asset.status !== 404) return asset;
      return new Response('Not Found', { status: 404 });

    } catch (e) {
      console.error('Worker error:', e.message);
      return json({ error: e.message || 'Internal Error' }, 500, cors);
    }
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...JSON_H, ...cors } });
}
