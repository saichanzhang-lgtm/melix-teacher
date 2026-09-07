// ═══════════════════════════════════════
// 知识库智能加载器（带内存缓存）
// ═══════════════════════════════════════
const fs = require('fs');
const path = require('path');

// 知识库文件定义：key → [相对路径, 优先级(越小越优先)]
const KB_FILES = {
  textbook:  ['references/textbook-database.md', 1],
  grammar:   ['references/grammar-scope.md', 2],
  exam:      ['references/beijing-exam-system.md', 3],
  templates: ['references/exam-templates.md', 4],
  vocabulary:['references/vocabulary-bank.json', 5],
  questions: ['references/exam-questions.json', 6],
  writing:   ['references/writing-bank.json', 7],
};

// 默认 token 预算（字符估算：1 token ≈ 2.5 中文字符）
const DEFAULT_CHAR_BUDGET = 48000; // ~16K tokens for KB portion

// ═══════ 内存缓存（启动时加载一次，避免每次请求读盘）═══════
let _cachedEntries = null;
let _cachedBaseDir = null;

function loadKnowledgeBase(baseDir) {
  // 缓存命中：同一 baseDir 直接返回
  if (_cachedEntries && _cachedBaseDir === baseDir) {
    return _cachedEntries;
  }

  const entries = [];
  for (const [key, [relPath, priority]] of Object.entries(KB_FILES)) {
    const fullPath = path.join(baseDir, relPath);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      entries.push({ key, priority, path: relPath, content, length: content.length });
      console.log(`  ✅ 已加载知识库: ${relPath} (${content.length} 字)`);
    } catch (e) {
      if (priority <= 4) {
        console.log(`  ⚠️ 核心知识库缺失: ${relPath}`);
      }
    }
  }

  // 写入缓存
  _cachedEntries = entries;
  _cachedBaseDir = baseDir;
  return entries;
}

// 按 agent 缓存构建好的 prompt 文本
const _promptCache = {};

function buildSystemPrompt(baseDir, agentFilter) {
  const cacheKey = (agentFilter || '_all') + '@' + baseDir;
  if (_promptCache[cacheKey]) return _promptCache[cacheKey];

  const entries = loadKnowledgeBase(baseDir);
  if (entries.length === 0) { _promptCache[cacheKey] = ''; return ''; }

  // 按优先级排序
  entries.sort((a, b) => a.priority - b.priority);

  // 智能截断：按优先级分配字符配额
  const sorted = entries.sort((a, b) => a.priority - b.priority);
  const totalLength = sorted.reduce((sum, e) => sum + e.length, 0);

  let kbText = '\n\n---\n## 知识库内容（以下为真实教材和考试数据，优先参考）\n';

  // 为每个文件分配配额（优先级越高配额越大）
  const weights = sorted.map((_, i) => sorted.length - i); // 降权
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let remainingBudget = DEFAULT_CHAR_BUDGET;

  sorted.forEach((entry, i) => {
    const quota = Math.floor(DEFAULT_CHAR_BUDGET * weights[i] / totalWeight);
    const useChars = Math.min(entry.length, quota, remainingBudget);
    if (useChars <= 0) return;

    // 智能截断：尽量在段落边界截断
    let content = entry.content.slice(0, useChars);
    if (useChars < entry.length) {
      const lastHeader = content.lastIndexOf('\n## ');
      if (lastHeader > useChars * 0.6) {
        content = content.slice(0, lastHeader);
      }
    }

    kbText += '\n### ' + entry.key + '\n' + content + '\n';
    remainingBudget -= useChars;
  });

  _promptCache[cacheKey] = kbText;
  return kbText;
}

module.exports = { loadKnowledgeBase, buildSystemPrompt, KB_FILES };
