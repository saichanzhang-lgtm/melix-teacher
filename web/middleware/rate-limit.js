// ═══════════════════════════════════════
// 简易速率限制中间件（进程内内存）
// ═══════════════════════════════════════

const WINDOW_MS = 60 * 1000; // 1分钟窗口
const MAX_REQUESTS = 10;      // 每窗口最大请求数

const buckets = {};

// 每60秒清理一次过期数据
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(buckets)) {
    buckets[key] = buckets[key].filter(ts => now - ts < WINDOW_MS);
    if (buckets[key].length === 0) delete buckets[key];
  }
}, 60000).unref();

/**
 * 对聊天 API 进行速率限制
 * @param {object} req - HTTP Request
 * @returns {object|null} 如果超限返回错误对象，否则返回 null
 */
function rateLimitChat(req) {
  // 按 IP + uid 组合限流
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const key = ip + '|' + token.slice(0, 20); // 混合 key

  const now = Date.now();
  if (!buckets[key]) buckets[key] = [];

  // 清理过期记录
  buckets[key] = buckets[key].filter(ts => now - ts < WINDOW_MS);

  if (buckets[key].length >= MAX_REQUESTS) {
    return { status: 429, message: '请求过于频繁，请稍等一分钟再试' };
  }

  buckets[key].push(now);
  return null; // 通过
}

module.exports = { rateLimitChat };
