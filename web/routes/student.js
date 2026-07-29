// ═══════════════════════════════════════
// 学生管理 API
// ═══════════════════════════════════════
const path = require('path');
const storage = require('../lib/storage');
const { getAuthUser } = require('../middleware/auth');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STUDENTS_DIR = path.join(DATA_DIR, 'students');
const JSON_HEADER = { 'Content-Type': 'application/json; charset=utf-8' };

// 内存缓存
let studentCache = null;
let cacheLoadedAt = 0;
const CACHE_TTL = 30 * 1000; // 30秒缓存

// 初始化数据目录
storage.ensureDir(STUDENTS_DIR);

// ═══════════════════════════════════════
// 缓存管理
// ═══════════════════════════════════════
function loadAllStudents() {
  const now = Date.now();
  if (studentCache && (now - cacheLoadedAt) < CACHE_TTL) {
    return studentCache;
  }

  const files = storage.listDir(STUDENTS_DIR);
  const students = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const student = storage.readJSON(path.join(STUDENTS_DIR, f));
    if (student) students.push(student);
  }
  studentCache = students;
  cacheLoadedAt = now;
  return students;
}

function invalidateCache() {
  studentCache = null;
  cacheLoadedAt = 0;
}

function findStudent(id) {
  return loadAllStudents().find(s => s.id === id) || null;
}

function saveStudent(student) {
  const filePath = path.join(STUDENTS_DIR, student.id + '.json');
  const ok = storage.writeJSON(filePath, student);
  if (ok) invalidateCache();
  return ok;
}

// ═══════════════════════════════════════
// 默认学生数据（首次初始化）
// ═══════════════════════════════════════
const DEFAULT_STUDENTS = [
  {
    id: 'nandy',
    name: 'Nandy',
    avatar: '👩',
    school: '北京市昌平区霍营小学',
    district: '昌平区',
    grade: '六年级',
    stage: '小学',
    textbook: { publisher: '北京版', stage: '小学', current: '六年级下册' },
    targetExam: '昌平区小升初统考 + 分班考试',
    currentScore: 95,
    targetScore: 100,
    weaknesses: ['审题细节', '完形填空逻辑', '写作时态一致性', '听力数字/日期细节'],
    strengths: ['词汇量', '语法基础', '阅读速度'],
    sessions: [
      { date: '2026-06-30', agent: 'exam', summary: '生成昌平区小升初模拟卷 第3套（难度★★★★☆）', duration: 60 },
      { date: '2026-06-23', agent: 'exam', summary: '生成昌平区小升初模拟卷 第2套', duration: 45 },
      { date: '2026-06-23', agent: 'teaching', summary: '首次建档 + 备考方案（6-8课时规划）', duration: 60 },
    ],
    createdAt: '2026-06-23',
    updatedAt: '2026-07-15',
  },
  {
    id: 'yiyi',
    name: '熠熠',
    avatar: '👧',
    school: '北京市海淀区某初中',
    district: '海淀区',
    grade: '初一',
    stage: '初中',
    textbook: { publisher: '人教版', stage: '初中', current: '七年级下册' },
    targetExam: '初一期末考试 + 初二英语提前学',
    currentScore: 88,
    targetScore: 95,
    weaknesses: ['海淀区完形填空逻辑推理', '阅读生词率适应', '写作内容连贯性'],
    strengths: ['语法基础扎实', '听力理解', '学习态度积极'],
    sessions: [
      { date: '2026-06-23', agent: 'teaching', summary: '首次建档 + 海淀区考情分析 + 初二提前学路线图', duration: 90 },
    ],
    createdAt: '2026-06-23',
    updatedAt: '2026-07-15',
  },
];

/**
 * 初始化默认学生数据（如果 students 目录为空）
 */
function initDefaultStudents() {
  const existing = loadAllStudents();
  if (existing.length === 0) {
    console.log('  📝 初始化默认学生数据...');
    for (const s of DEFAULT_STUDENTS) {
      saveStudent(s);
      console.log('    ✅ 已创建学生: ' + s.name + ' (' + s.id + ')');
    }
  }
}

// ═══════════════════════════════════════
// API Handlers
// ═══════════════════════════════════════

// GET /api/students — 列出所有学生
async function handleListStudents(req, res) {
  const students = loadAllStudents();
  // 返回摘要（不含大型内容字段）
  const summary = students.map(s => ({
    id: s.id,
    name: s.name,
    avatar: s.avatar,
    school: s.school,
    district: s.district,
    grade: s.grade,
    stage: s.stage,
    currentScore: s.currentScore,
    targetScore: s.targetScore,
    sessionCount: (s.sessions || []).length,
    updatedAt: s.updatedAt,
  }));
  res.writeHead(200, JSON_HEADER);
  res.end(JSON.stringify(summary));
}

// GET /api/students/:id — 获取单个学生详情
async function handleGetStudent(req, res, studentId) {
  const student = findStudent(studentId);
  if (!student) {
    res.writeHead(404, JSON_HEADER);
    res.end(JSON.stringify({ error: '学生不存在: ' + studentId }));
    return;
  }
  res.writeHead(200, JSON_HEADER);
  res.end(JSON.stringify(student));
}

// POST /api/students — 创建学生（需登录）
async function handleCreateStudent(req, res, data) {
  const user = getAuthUser(req);
  if (!user) {
    res.writeHead(401, JSON_HEADER);
    res.end(JSON.stringify({ error: '请先登录' }));
    return;
  }

  if (!data.id || !data.name) {
    res.writeHead(400, JSON_HEADER);
    res.end(JSON.stringify({ error: 'id 和 name 是必填字段' }));
    return;
  }

  // 检查是否已存在
  if (findStudent(data.id)) {
    res.writeHead(409, JSON_HEADER);
    res.end(JSON.stringify({ error: '学生ID已存在: ' + data.id }));
    return;
  }

  const student = {
    id: data.id,
    name: data.name,
    avatar: data.avatar || '👤',
    school: data.school || '',
    district: data.district || '',
    grade: data.grade || '',
    stage: data.stage || '',
    textbook: data.textbook || {},
    targetExam: data.targetExam || '',
    currentScore: data.currentScore || 0,
    targetScore: data.targetScore || 100,
    weaknesses: data.weaknesses || [],
    strengths: data.strengths || [],
    sessions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveStudent(student);
  console.log('  👨‍🎓 新学生已创建: ' + student.name + ' (' + student.id + ')');

  res.writeHead(201, JSON_HEADER);
  res.end(JSON.stringify(student));
}

// PUT /api/students/:id — 更新学生信息（需登录）
async function handleUpdateStudent(req, res, studentId, data) {
  const user = getAuthUser(req);
  if (!user) {
    res.writeHead(401, JSON_HEADER);
    res.end(JSON.stringify({ error: '请先登录' }));
    return;
  }

  const student = findStudent(studentId);
  if (!student) {
    res.writeHead(404, JSON_HEADER);
    res.end(JSON.stringify({ error: '学生不存在: ' + studentId }));
    return;
  }

  // 合并更新（保护 id 和 createdAt）
  const protected = ['id', 'createdAt'];
  for (const [key, value] of Object.entries(data)) {
    if (protected.includes(key)) continue;
    student[key] = value;
  }
  student.updatedAt = new Date().toISOString();

  saveStudent(student);
  res.writeHead(200, JSON_HEADER);
  res.end(JSON.stringify(student));
}

// POST /api/students/:id/sessions — 记录学习会话（需登录）
async function handleAddSession(req, res, studentId, data) {
  const user = getAuthUser(req);
  if (!user) {
    res.writeHead(401, JSON_HEADER);
    res.end(JSON.stringify({ error: '请先登录' }));
    return;
  }

  const student = findStudent(studentId);
  if (!student) {
    res.writeHead(404, JSON_HEADER);
    res.end(JSON.stringify({ error: '学生不存在: ' + studentId }));
    return;
  }

  const session = {
    date: new Date().toISOString().slice(0, 10),
    agent: data.agent || 'teaching',
    summary: data.summary || '学习会话',
    duration: data.duration || 30,
    topics: data.topics || [],
    notes: data.notes || '',
  };

  if (!student.sessions) student.sessions = [];
  student.sessions.unshift(session); // 最新的在前
  student.updatedAt = new Date().toISOString();

  // 如果有知识点更新，合并到 weaknesses/strengths
  if (data.newWeaknesses && Array.isArray(data.newWeaknesses)) {
    const existing = new Set(student.weaknesses || []);
    data.newWeaknesses.forEach(w => existing.add(w));
    student.weaknesses = [...existing];
  }

  saveStudent(student);
  console.log('  📝 学习会话已记录: ' + student.name + ' — ' + session.summary);

  res.writeHead(200, JSON_HEADER);
  res.end(JSON.stringify({ success: true, session, student }));
}

// GET /api/students/:id/progress — 获取学习进度报告
async function handleGetProgress(req, res, studentId) {
  const student = findStudent(studentId);
  if (!student) {
    res.writeHead(404, JSON_HEADER);
    res.end(JSON.stringify({ error: '学生不存在: ' + studentId }));
    return;
  }

  const sessions = student.sessions || [];
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  // 按 agent 统计
  const agentStats = {};
  sessions.forEach(s => {
    const agent = s.agent || 'unknown';
    if (!agentStats[agent]) agentStats[agent] = 0;
    agentStats[agent]++;
  });

  // 按月份统计
  const monthlyStats = {};
  sessions.forEach(s => {
    const month = s.date ? s.date.slice(0, 7) : 'unknown';
    if (!monthlyStats[month]) monthlyStats[month] = 0;
    monthlyStats[month]++;
  });

  const progress = {
    student: {
      id: student.id,
      name: student.name,
      grade: student.grade,
      currentScore: student.currentScore,
      targetScore: student.targetScore,
    },
    summary: {
      totalSessions,
      totalMinutes,
      firstSession: sessions.length > 0 ? sessions[sessions.length - 1].date : null,
      lastSession: sessions.length > 0 ? sessions[0].date : null,
    },
    weaknesses: student.weaknesses || [],
    strengths: student.strengths || [],
    agentDistribution: agentStats,
    monthlyActivity: monthlyStats,
    recentSessions: sessions.slice(0, 10),
  };

  res.writeHead(200, JSON_HEADER);
  res.end(JSON.stringify(progress));
}

module.exports = {
  handleListStudents,
  handleGetStudent,
  handleCreateStudent,
  handleUpdateStudent,
  handleAddSession,
  handleGetProgress,
  initDefaultStudents,
  loadAllStudents,
  findStudent,
};
