// ═══════════════════════════════════════
// 文件系统存储封装
// ═══════════════════════════════════════
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return null;
  }
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
}

module.exports = { ensureDir, readJSON, writeJSON, readFile, listDir };
