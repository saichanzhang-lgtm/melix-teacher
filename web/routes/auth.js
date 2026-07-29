// ═══════════════════════════════════════
// 认证路由
// ═══════════════════════════════════════
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('../lib/jwt');
const storage = require('../lib/storage');
const { USERS_DIR } = require('../middleware/auth');

const jsonH = { 'Content-Type': 'application/json; charset=utf-8' };
const ENV = process.env.NODE_ENV || 'development';
const INVITE_MODE = process.env.INVITE_MODE === 'true';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const INVITES_DIR = path.join(DATA_DIR, 'invites');

// Verification codes (in-memory, TTL 5min)
const codeStore = {};

function setCode(phone, code) {
  codeStore[phone] = { code, exp: Date.now() + 300000 };
}

function verifyCode(phone, code) {
  const c = codeStore[phone];
  if (!c || Date.now() > c.exp) return false;
  if (c.code !== code) return false;
  delete codeStore[phone];
  return true;
}

function uid() {
  return 'u_' + crypto.randomBytes(12).toString('hex');
}

function loadUser(uid) {
  return storage.readJSON(path.join(USERS_DIR, uid + '.json'));
}

function saveUser(user) {
  storage.writeJSON(path.join(USERS_DIR, user.uid + '.json'), user);
}

function createUser(phone) {
  const user = {
    uid: uid(), phone, nickname: '教师' + phone.slice(-4),
    avatar: '', role: 'teacher', status: 'active',
    createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
    inviteCode: '', workspace: { students: [], preferences: {} }
  };
  saveUser(user);
  return user;
}

function getUserDir(uid) {
  const d = path.join(DATA_DIR, uid);
  storage.ensureDir(d);
  return d;
}

// Invite codes
function genInviteCode() {
  return 'BJ' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function loadInvites() {
  return storage.readJSON(path.join(INVITES_DIR, 'codes.json')) || [];
}

function saveInvites(invites) {
  storage.writeJSON(path.join(INVITES_DIR, 'codes.json'), invites);
}

async function handleSendCode(req, res, data) {
  const phone = (data && data.phone) || '';
  if (!/^1\d{10}$/.test(phone)) {
    res.writeHead(400, jsonH);
    res.end(JSON.stringify({ error: '手机号格式不正确' }));
    return;
  }
  const code = ENV === 'development' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
  setCode(phone, code);
  const devMsg = ENV === 'development' ? ' (开发模式: ' + code + ')' : '';
  console.log('📱 验证码 [' + phone + ']: ' + code + devMsg);
  // TODO: 生产环境接入阿里云短信服务 / 腾讯云短信服务
  res.writeHead(200, jsonH);
  res.end(JSON.stringify({ success: true, message: '验证码: ' + code + ' (有效期5分钟，未配置短信服务，请在登录页输入此验证码)' }));
}

async function handleLogin(req, res, data) {
  const phone = (data && data.phone) || '';
  const code = (data && data.code) || '';

  if (!verifyCode(phone, code)) {
    res.writeHead(401, jsonH);
    res.end(JSON.stringify({ error: '验证码错误或已过期' }));
    return;
  }

  // Check invite mode
  if (INVITE_MODE) {
    const invite = (data && data.invite) || '';
    const invites = loadInvites();
    const inv = invites.find(i => i.code === invite && i.used < i.maxUses);
    if (!inv) {
      res.writeHead(403, jsonH);
      res.end(JSON.stringify({ error: '邀请码无效或已用完' }));
      return;
    }
    inv.used++;
    saveInvites(invites);
  }

  // Find or create user
  let user = null;
  try {
    const files = fs.readdirSync(USERS_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const u = JSON.parse(fs.readFileSync(path.join(USERS_DIR, f), 'utf8'));
      if (u.phone === phone) { user = u; break; }
    }
  } catch (e) { /* ignore */ }

  if (!user) user = createUser(phone);
  user.lastLogin = new Date().toISOString();
  saveUser(user);

  // Issue JWT (30 days)
  const token = jwt.sign({
    uid: user.uid, phone: user.phone, role: user.role,
    exp: Math.floor(Date.now() / 1000) + 2592000
  });
  getUserDir(user.uid);

  res.writeHead(200, jsonH);
  res.end(JSON.stringify({
    token,
    user: { uid: user.uid, phone: user.phone, nickname: user.nickname, role: user.role, avatar: user.avatar }
  }));
}

async function handleMe(req, res, getAuthUserFn) {
  const user = getAuthUserFn(req);
  if (!user) {
    res.writeHead(401, jsonH);
    res.end(JSON.stringify({ error: '请先登录' }));
    return;
  }
  res.writeHead(200, jsonH);
  res.end(JSON.stringify({
    user: { uid: user.uid, phone: user.phone, nickname: user.nickname, role: user.role, avatar: user.avatar, workspace: user.workspace }
  }));
}

module.exports = {
  handleSendCode, handleLogin, handleMe,
  // 导出供其他模块使用
  loadUser, saveUser, createUser, uid, getUserDir,
  loadInvites, saveInvites, genInviteCode,
  USERS_DIR, DATA_DIR, INVITES_DIR
};
