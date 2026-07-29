// ═══════════════════════════════════════
// 管理后台路由
// ═══════════════════════════════════════
const fs = require('fs');
const { getAuthUser, isAdmin, USERS_DIR } = require('../middleware/auth');
const { loadInvites, saveInvites, genInviteCode } = require('./auth');

const jsonH = { 'Content-Type': 'application/json; charset=utf-8' };
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';
const ENV = process.env.NODE_ENV || 'development';
const INVITE_MODE = process.env.INVITE_MODE === 'true';

function adminStats() {
  let userCount = 0;
  try {
    userCount = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json')).length;
  } catch (e) { /* ignore */ }
  return {
    userCount,
    activeToday: 0,
    model: MODEL,
    kbLoaded: true,
    env: ENV,
    inviteMode: INVITE_MODE,
    timestamp: new Date().toISOString(),
  };
}

async function handleStats(req, res) {
  const user = getAuthUser(req);
  if (!user || !isAdmin(user.uid)) {
    res.writeHead(403, jsonH);
    res.end(JSON.stringify({ error: '需要管理员权限' }));
    return;
  }
  res.writeHead(200, jsonH);
  res.end(JSON.stringify(adminStats()));
}

async function handleGetInvites(req, res) {
  const user = getAuthUser(req);
  if (!user || !isAdmin(user.uid)) {
    res.writeHead(403, jsonH);
    res.end(JSON.stringify({ error: '需要管理员权限' }));
    return;
  }
  res.writeHead(200, jsonH);
  res.end(JSON.stringify(loadInvites()));
}

async function handleCreateInvites(req, res, data) {
  const user = getAuthUser(req);
  if (!user || !isAdmin(user.uid)) {
    res.writeHead(403, jsonH);
    res.end(JSON.stringify({ error: '需要管理员权限' }));
    return;
  }
  const count = (data && data.count) || 5;
  const maxUses = (data && data.maxUses) || 1;
  const invites = loadInvites();
  for (let i = 0; i < count; i++) {
    invites.push({ code: genInviteCode(), maxUses, used: 0, createdAt: new Date().toISOString() });
  }
  saveInvites(invites);
  res.writeHead(200, jsonH);
  res.end(JSON.stringify({ created: count, invites: invites.slice(-count) }));
}

module.exports = { handleStats, handleGetInvites, handleCreateInvites };
