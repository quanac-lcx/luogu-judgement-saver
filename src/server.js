const express = require('express');
const path = require('path');
const {
  getJudgementRecords,
  getJudgementCount,
  getFetchLogs,
  getFetchLogCount
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3457;

// JSON 中间件
app.use(express.json());

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * GET /api/judgement - 获取 judgement 记录
 * 查询参数:
 *   page - 页码 (默认 1)
 *   limit - 每页条数 (默认 50)
 *   uid - 按用户 UID 筛选（可选）
 */
app.get('/api/judgement', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const filters = {};
    if (req.query.uid) filters.uid = req.query.uid.trim();
    if (req.query.name) filters.name = req.query.name.trim();
    if (req.query.rev_perm) filters.rev_perm = req.query.rev_perm.split(',').map(Number).filter(v => v);
    if (req.query.add_perm) filters.add_perm = req.query.add_perm.split(',').map(Number).filter(v => v);
    if (req.query.no_perm === '1') filters.no_perm = true;

    const total = getJudgementCount(filters);
    const records = getJudgementRecords(limit, offset, filters);

    // 解析 raw_user 和 raw_data JSON 字段
    const parsedRecords = records.map(r => ({
      id: r.id,
      uid: r.uid,
      name: r.name,
      reason: r.reason,
      revoked_permission: r.revoked_permission,
      added_permission: r.added_permission,
      time: r.time,
      user: JSON.parse(r.raw_user),
      full_record: JSON.parse(r.raw_data),
      fetch_log_id: r.fetch_log_id,
      log_fetched_at: r.log_fetched_at,
      created_at: r.created_at
    }));

    res.json({
      success: true,
      data: parsedRecords,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/logs - 获取抓取日志
 * 查询参数:
 *   page - 页码 (默认 1)
 *   limit - 每页条数 (默认 50)
 */
app.get('/api/logs', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const total = getFetchLogCount();
    const logs = getFetchLogs(limit, offset);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stats - 获取统计信息
 */
app.get('/api/stats', (req, res) => {
  try {
    const totalJudgements = getJudgementCount();
    const totalLogs = getFetchLogCount();

    res.json({
      success: true,
      data: {
        total_judgements: totalJudgements,
        total_fetch_logs: totalLogs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /judgement - 显示 judgement 记录页面
 */
app.get('/judgement', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/**
 * GET /logs - 显示抓取日志页面
 */
app.get('/logs', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

/**
 * 启动服务器
 */
function startServer() {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`HTTP 服务器已启动: http://localhost:${PORT}`);
      console.log(`  GET /judgement - 查看 judgement 记录`);
      console.log(`  GET /logs      - 查看抓取日志`);
      console.log(`  GET /api/stats  - 查看统计信息`);
      resolve(app);
    });
  });
}

module.exports = { startServer, app };
