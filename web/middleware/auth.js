// ═══════════════════════════════════════
// 认证中间件
// ═══════════════════════════════════════
const jwt = require('../lib/jwt');
const storage = require('../lib/storage');
const path = require('path');

const USERS_DIR = path.join(__dirname, '..', '..', 'data', 'users');

function loadUser(uid) {
  return storage.readJSON(path.join(USERS_DIR, uid + '.json'));
}

function getAuthUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  const payload = jwt.verify(token);
  if (!payload || !payload.uid) return null;
  return loadUser(payload.uid);
}

function isAdmin(uid) {
  const user = loadUser(uid);
  return user && user.role === 'admin';
}

module.exports = { getAuthUser, isAdmin, loadUser, USERS_DIR };
