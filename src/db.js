const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'judgements.db');

// 确保 data 目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

/**
 * 初始化数据库（加载已有数据或创建新库）
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log(`数据库已加载: ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log('已创建新数据库');
  }

  // 创建表（如果不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS judgement_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid INTEGER NOT NULL,
      name TEXT NOT NULL,
      reason TEXT,
      revoked_permission INTEGER DEFAULT 0,
      added_permission INTEGER DEFAULT 0,
      time INTEGER NOT NULL,
      raw_user TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      fetch_log_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_jr_uid ON judgement_records(uid)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_jr_time ON judgement_records(time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_jr_fetch_log_id ON judgement_records(fetch_log_id)`);

  // 唯一索引：防止同一条记录被重复插入
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jr_unique
    ON judgement_records(uid, time, reason, revoked_permission, added_permission)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fetch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT DEFAULT (datetime('now', 'localtime')),
      record_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      error_message TEXT,
      raw_response TEXT
    )
  `);

  saveDatabase();
}

/**
 * 将数据库持久化到磁盘
 */
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * 插入一条抓取日志
 */
function insertFetchLog(recordCount, status = 'success', errorMessage = null, rawResponse = null) {
  db.run(
    `INSERT INTO fetch_logs (record_count, status, error_message, raw_response) VALUES (?, ?, ?, ?)`,
    [recordCount, status, errorMessage, rawResponse]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];
  saveDatabase();
  return { id, recordCount, status };
}

/**
 * 插入一条 judgement 记录（已存在则跳过）
 * @returns {boolean} true 表示新插入，false 表示已存在跳过
 */
function insertJudgementRecord(record, fetchLogId) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO judgement_records (uid, name, reason, revoked_permission, added_permission, time, raw_user, raw_data, fetch_log_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run([
    record.user.uid,
    record.user.name,
    record.reason,
    record.revokedPermission,
    record.addedPermission,
    record.time,
    JSON.stringify(record.user),
    JSON.stringify(record),
    fetchLogId
  ]);
  const inserted = db.getRowsModified() > 0;
  stmt.free();
  return inserted;
}

/**
 * 批量插入后保存
 */
function saveAfterBatch() {
  saveDatabase();
}

/**
 * 获取抓取日志（倒序）
 */
function getFetchLogs(limit = 100, offset = 0) {
  const stmt = db.prepare(
    `SELECT id, fetched_at, record_count, status, error_message FROM fetch_logs ORDER BY id DESC LIMIT ? OFFSET ?`
  );
  stmt.bind([limit, offset]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * 获取 judgement 记录（倒序，可选按 uid 筛选）
 */
function getJudgementRecords(limit = 100, offset = 0, filters = {}) {
  const { uid, name, rev_perm, add_perm } = filters;
  const conditions = [];
  const params = [];

  if (uid) {
    conditions.push('jr.uid = ?');
    params.push(uid);
  }
  if (name) {
    conditions.push('jr.name LIKE ?');
    params.push(`%${name}%`);
  }
  if (rev_perm && rev_perm.length) {
    const ands = rev_perm.map(() => 'jr.revoked_permission & ?');
    conditions.push('(' + ands.join(' AND ') + ')');
    rev_perm.forEach(v => params.push(v));
  }
  if (add_perm && add_perm.length) {
    const ands = add_perm.map(() => 'jr.added_permission & ?');
    conditions.push('(' + ands.join(' AND ') + ')');
    add_perm.forEach(v => params.push(v));
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT jr.*, fl.fetched_at as log_fetched_at
       FROM judgement_records jr
       LEFT JOIN fetch_logs fl ON jr.fetch_log_id = fl.id
       ${where}
       ORDER BY jr.time DESC, jr.id DESC
       LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * 获取 judgement 记录总数
 */
function getJudgementCount(filters = {}) {
  const { uid, name, rev_perm, add_perm } = filters;
  const conditions = [];
  const params = [];

  if (uid) {
    conditions.push('uid = ?');
    params.push(uid);
  }
  if (name) {
    conditions.push('name LIKE ?');
    params.push(`%${name}%`);
  }
  if (rev_perm && rev_perm.length) {
    const ands = rev_perm.map(() => 'revoked_permission & ?');
    conditions.push('(' + ands.join(' AND ') + ')');
    rev_perm.forEach(v => params.push(v));
  }
  if (add_perm && add_perm.length) {
    const ands = add_perm.map(() => 'added_permission & ?');
    conditions.push('(' + ands.join(' AND ') + ')');
    add_perm.forEach(v => params.push(v));
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM judgement_records ${where}`);
  stmt.bind(params);
  let count = 0;
  if (stmt.step()) {
    count = stmt.getAsObject().count;
  }
  stmt.free();
  return count;
}

/**
 * 获取日志总数
 */
function getFetchLogCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM fetch_logs');
  let count = 0;
  if (stmt.step()) {
    count = stmt.getAsObject().count;
  }
  stmt.free();
  return count;
}

module.exports = {
  initDatabase,
  saveAfterBatch,
  insertFetchLog,
  insertJudgementRecord,
  getFetchLogs,
  getJudgementRecords,
  getJudgementCount,
  getFetchLogCount
};
