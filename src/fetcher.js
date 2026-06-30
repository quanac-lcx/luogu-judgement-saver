const https = require('https');
const zlib = require('zlib');

const JUDGEMENT_URL = 'https://www.luogu.com.cn/judgement';

/**
 * 从洛谷 API 获取 judgement 数据
 * @returns {Promise<{logs: Array}>} 返回解析后的 JSON 数据
 */
function fetchJudgements() {
    return new Promise((resolve, reject) => {
        const url = new URL(JUDGEMENT_URL);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.luogu.com.cn/judgement',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
            }
        };

        const req = https.request(options, (res) => {
            let rawData = '';

            const encoding = res.headers['content-encoding'];
            let stream = res;

            if (encoding === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === 'deflate') {
                stream = res.pipe(zlib.createInflate());
            } else if (encoding === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

            stream.on('data', (chunk) => {
                rawData += chunk.toString();
            });

            stream.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const data = JSON.parse(rawData);
                        resolve(data);
                    } catch (e) {
                        reject(new Error(`JSON 解析失败: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${rawData.substring(0, 200)}`));
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

module.exports = { fetchJudgements };
