// ═══════════════════════════════════════
// JWT 工具 — HMAC-SHA256
// ═══════════════════════════════════════
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || '';

function getSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 环境变量未设置，拒绝启动。请在 .env 中配置。');
  }
  return JWT_SECRET;
}

function sign(payload) {
  const secret = getSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

function verify(token) {
  try {
    const secret = getSecret();
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
    if (expectedSig !== sig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp * 1000) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify };
