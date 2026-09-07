// ═══════════════════════════════════════
// AI 聊天路由 — SSE 流式响应
// ═══════════════════════════════════════
const path = require('path');
const aiClient = require('../lib/ai-client');
const kbLoader = require('../lib/kb-loader');
const { rateLimitChat } = require('../middleware/rate-limit');

const BASE_DIR = process.env.BASE_DIR || path.join(__dirname, '..', '..');
const CLAUDE_PATHS = [
  path.join(BASE_DIR, 'CLAUDE.md'),
  'D:/CLAUDE.md',
  path.join(__dirname, '..', '..', 'CLAUDE.md'),
];

let BASE_SYSTEM_PROMPT = '';

// ═══════ System Prompt 缓存（按 agent 缓存，避免每次正则提取）═══════
const _fullPromptCache = {};

function loadBasePrompt() {
  for (const p of CLAUDE_PATHS) {
    try {
      const fs = require('fs');
      BASE_SYSTEM_PROMPT = fs.readFileSync(p, 'utf-8');
      console.log('  ✅ 已加载 CLAUDE.md (' + p + ')');
      return;
    } catch (e) { /* continue */ }
  }
  console.log('  ⚠️ CLAUDE.md 未找到，使用默认配置');
  BASE_SYSTEM_PROMPT = '你是北京市K12英语AI教学专家。';
}

// 启动时加载
loadBasePrompt();

/**
 * 构建最终 system prompt
 * @param {string} agentFilter - 可选，过滤到特定 Agent 的 prompt
 */
function buildFullSystemPrompt(agentFilter) {
  const cacheKey = agentFilter || '_default';
  if (_fullPromptCache[cacheKey]) return _fullPromptCache[cacheKey];

  let prompt = BASE_SYSTEM_PROMPT;

  // 如果指定了 agent，提取相关部分的 prompt（约减少 40% token）
  if (agentFilter) {
    const agentSection = extractAgentSection(prompt, agentFilter);
    if (agentSection) {
      // 保留 ROLE + GLOBAL RULES + OUTPUT REQUIREMENTS + ULTIMATE GOAL（公共部分）
      const publicParts = extractPublicSections(prompt);
      prompt = publicParts + '\n\n' + agentSection;
    }
  }

  // 拼接知识库
  const kbText = kbLoader.buildSystemPrompt(BASE_DIR, agentFilter);
  prompt += kbText;

  _fullPromptCache[cacheKey] = prompt;
  return prompt;
}

function extractAgentSection(fullPrompt, agentName) {
  // Agent 标记行格式: # AGENT N — ...
  const agentMap = {
    teaching: '教材智能教学系统',
    grammar: '语法中心',
    exam: '智能组卷系统',
    grade: '智能阅卷系统',
    writing: '作文中心',
    vocabulary: '智能词汇检测中心',
  };

  const label = agentMap[agentName];
  if (!label) return '';

  // 匹配到下一个 # AGENT 或文件结尾
  const pattern = new RegExp(
    '(# AGENT \\d+ [—\\-].*?' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?)(?=\n# AGENT \\d+ |\n# ULTIMATE GOAL|\n# OUTPUT REQUIREMENTS|$)',
    'i'
  );
  const match = fullPrompt.match(pattern);
  return match ? match[1] : '';
}

function extractPublicSections(fullPrompt) {
  const parts = [];
  const roleMatch = fullPrompt.match(/(# ROLE[\s\S]*?)(?=\n# GLOBAL RULES)/);
  if (roleMatch) parts.push(roleMatch[1]);
  const rulesMatch = fullPrompt.match(/(# GLOBAL RULES[\s\S]*?)(?=\n# AGENT 1)/);
  if (rulesMatch) parts.push(rulesMatch[1]);
  const outputMatch = fullPrompt.match(/(# OUTPUT REQUIREMENTS[\s\S]*?)(?=\n# 学生档案|───|$)/);
  if (outputMatch) parts.push(outputMatch[1]);
  const goalMatch = fullPrompt.match(/(# ULTIMATE GOAL[\s\S]*)/);
  if (goalMatch) parts.push(goalMatch[1]);
  return parts.join('\n\n') || fullPrompt;
}

async function handleChat(req, res, body) {
  try {
    const messages = body.messages || [];

    // 输入校验
    if (!Array.isArray(messages) || messages.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'messages required (non-empty array)' }));
      return;
    }

    // 检查消息长度（防止滥用）
    const totalChars = messages.reduce((s, m) => s + (m.content || '').length, 0);
    if (totalChars > 100000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '消息总长度超过限制' }));
      return;
    }

    // 速率限制
    const rateLimitError = rateLimitChat(req);
    if (rateLimitError) {
      res.writeHead(rateLimitError.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: rateLimitError.message }));
      return;
    }

    // 提取 agent 过滤参数
    const agentFilter = body.agent || '';

    // 构建 system prompt
    const systemPrompt = buildFullSystemPrompt(agentFilter);

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await aiClient.callAI(systemPrompt, messages, res);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
      res.end();
    }
  }
}

module.exports = { handleChat, buildFullSystemPrompt };
