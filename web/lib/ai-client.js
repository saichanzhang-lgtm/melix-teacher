// ═══════════════════════════════════════
// AI API 客户端（流式 + 重试 + 降级）
// ═══════════════════════════════════════

const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || '';
const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';
const FALLBACK_MODEL = process.env.ANTHROPIC_FALLBACK_MODEL || '';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 指数退避

function isRetryableError(statusCode, error) {
  if (error && error.code === 'ECONNRESET') return true;
  if (statusCode === 429) return true;
  if (statusCode >= 500) return true;
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 调用 AI API（带重试和降级）
 * @param {string} systemPrompt - 系统提示词
 * @param {Array} messages - 消息数组
 * @param {object} res - HTTP Response 对象（用于 SSE 流式输出）
 */
async function callAI(systemPrompt, messages, res) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 最后一次重试尝试降级模型
    const model = (attempt === MAX_RETRIES && FALLBACK_MODEL) ? FALLBACK_MODEL : MODEL;

    if (attempt > 0) {
      console.log(`  🔄 AI 调用重试 ${attempt}/${MAX_RETRIES} (模型: ${model})...`);
      await sleep(RETRY_DELAYS[attempt - 1] || 3000);
    }

    try {
      await streamRequest(systemPrompt, messages, model, res);
      return; // 成功，退出
    } catch (e) {
      lastError = e;
      const statusCode = e.statusCode || 0;

      if (!isRetryableError(statusCode, e) || attempt === MAX_RETRIES) {
        throw e; // 不可重试或已达最大重试次数
      }
      console.log(`  ⚠️ AI 调用失败 (${e.message})，准备重试...`);
    }
  }

  throw lastError;
}

function streamRequest(systemPrompt, messages, model, res) {
  const body = JSON.stringify({
    model: model,
    system: systemPrompt,
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
          } catch (e) { /* ignore */ }
          const err = new Error(errMsg);
          err.statusCode = apiRes.statusCode;
          reject(err);
        });
        return;
      }

      let buffer = '';
      let streamEnded = false;

      apiRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
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
                const usage = parsed.usage || parsed.message?.usage || null;
                const doneMsg = { type: 'done' };
                if (usage) doneMsg.usage = usage;
                res.write(`data: ${JSON.stringify(doneMsg)}\n\n`);
              } else if (parsed.type === 'message' && !streamEnded) {
                // Non-streaming response fallback
                streamEnded = true;
                const text = parsed.content?.map(c => c.text || '').join('') || '';
                if (text) {
                  res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
                }
                const usage = parsed.usage || null;
                const doneMsg = { type: 'done' };
                if (usage) doneMsg.usage = usage;
                res.write(`data: ${JSON.stringify(doneMsg)}\n\n`);
              }
            } catch (e) {
              // skip parse errors in stream
            }
          }
        }
      });

      apiRes.on('end', () => {
        if (!streamEnded) {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }
        res.end();
        resolve();
      });

      apiRes.on('error', reject);
    });

    apiReq.on('error', (e) => {
      e.statusCode = 0;
      reject(e);
    });

    apiReq.write(body);
    apiReq.end();
  });
}

module.exports = { callAI, API_KEY, API_BASE, MODEL };
