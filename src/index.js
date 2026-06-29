const { initDatabase } = require('./db');
const { startServer } = require('./server');
const { startScheduler } = require('./scheduler');

async function main() {
    console.log('luogu-judgement-saver 启动中...');
    console.log('='.repeat(50));

    // 初始化数据库
    await initDatabase();

    // 启动 HTTP 服务器
    await startServer();

    // 启动定时抓取任务
    startScheduler();

    console.log('='.repeat(50));
    console.log('系统已就绪');
}

main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
});
