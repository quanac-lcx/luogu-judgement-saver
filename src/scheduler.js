const cron = require('node-cron');
const { fetchJudgements } = require('./fetcher');
const { insertFetchLog, insertJudgementRecord, saveDatabase } = require('./db');

/**
 * 执行一次数据抓取并保存到数据库
 * @returns {Promise<{status: string, count: number, error?: string}>}
 */
async function runFetch() {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] 开始抓取 judgement 数据...`);

    try {
        const data = await fetchJudgements();
        const logs = data.logs || [];

        if (!Array.isArray(logs)) {
            throw new Error(`响应数据格式异常: 期望 logs 为数组, 实际为 ${typeof logs}`);
        }

        // 先插入抓取日志（记录 API 返回的总条数）
        const rawResponse = JSON.stringify(data);
        const fetchLog = insertFetchLog(logs.length, 'success', null, rawResponse);

        // 逐条插入 judgement 记录（去重：INSERT OR IGNORE）
        let newCount = 0;
        let skippedCount = 0;
        for (const record of logs) {
            try {
                const inserted = insertJudgementRecord(record, fetchLog.id);
                if (inserted) {
                    newCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error(`  插入记录失败 (uid=${record.user?.uid}): ${err.message}`);
            }
        }

        // 批量插入后统一保存
        saveDatabase();

        const elapsed = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] 抓取完成: API 返回 ${logs.length} 条, 新增 ${newCount} 条, 跳过重复 ${skippedCount} 条, 耗时 ${elapsed}ms`);
        return { status: 'success', count: newCount };
    } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[${new Date().toISOString()}] 抓取失败 (耗时 ${elapsed}ms): ${err.message}`);
        insertFetchLog(0, 'error', err.message, null);
        return { status: 'error', count: 0, error: err.message };
    }
}

/**
 * 启动定时任务（每20分钟执行一次）
 */
function startScheduler() {
    const task = cron.schedule('*/20 * * * *', async () => {
        await runFetch();
    });

    console.log('定时任务已启动: 每20分钟抓取一次 judgement 数据');

    // 启动后立即执行一次
    runFetch();

    return task;
}

module.exports = { startScheduler, runFetch };
