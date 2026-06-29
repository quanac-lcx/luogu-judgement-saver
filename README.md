# luogu-judgement-saver

定期从 [洛谷陶片放逐](https://www.luogu.com.cn/judgement) 抓取 judgement 记录并存入 SQLite 数据库，提供 Web 界面和 JSON API 供查阅。

## 依赖

- [Node.js](https://nodejs.org/) ≥ 18
- [sql.js](https://github.com/sql-js/sql.js/) — SQLite WASM 实现，**无需系统安装 SQLite**
- [Express](https://expressjs.com/) — HTTP 服务
- [node-cron](https://github.com/node-cron/node-cron) — 定时任务

## 快速开始

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd luogu-judgement-saver

# 2. 安装依赖
npm install

# 3. 启动
npm start
```

启动后访问 http://localhost:3457/judgement 查看记录。

---

## 部署到 Linux

以下以 Ubuntu/Debian 为例，其他发行版请调整对应命令。

### 方式一：PM2（推荐，简单易维护）

#### 1. 安装 Node.js 及 PM2

```bash
# 使用 NodeSource 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2
sudo npm install -g pm2
```

#### 2. 部署项目

```bash
cd /opt
sudo git clone <your-repo-url> luogu-judgement-saver
sudo chown -R $USER:$USER /opt/luogu-judgement-saver
cd /opt/luogu-judgement-saver
npm install --production
```

#### 3. 使用 PM2 启动

```bash
pm2 start src/index.js --name luogu-judgement-saver
pm2 save
pm2 startup   # 设置开机自启（按提示执行输出的命令）
```

常用 PM2 命令：

```bash
pm2 status                          # 查看状态
pm2 logs luogu-judgement-saver      # 查看日志
pm2 restart luogu-judgement-saver   # 重启
pm2 stop luogu-judgement-saver      # 停止
```

### 方式二：systemd（无额外依赖）

#### 1. 安装 Node.js 并部署项目

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

cd /opt
sudo git clone <your-repo-url> luogu-judgement-saver
sudo chown -R $USER:$USER /opt/luogu-judgement-saver
cd /opt/luogu-judgement-saver
npm install --production
```

#### 2. 创建 systemd 服务

```bash
sudo nano /etc/systemd/system/luogu-judgement-saver.service
```

写入以下内容：

```ini
[Unit]
Description=Luogu Judgement Saver
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/luogu-judgement-saver
ExecStart=/usr/bin/node /opt/luogu-judgement-saver/src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# 安全加固（可选）
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target
```

#### 3. 赋予 data 目录写权限

```bash
sudo mkdir -p /opt/luogu-judgement-saver/data
sudo chown -R www-data:www-data /opt/luogu-judgement-saver/data
```

#### 4. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now luogu-judgement-saver
sudo systemctl status luogu-judgement-saver   # 检查状态
```

常用 systemd 命令：

```bash
sudo systemctl status luogu-judgement-saver    # 状态
sudo systemctl restart luogu-judgement-saver   # 重启
sudo systemctl stop luogu-judgement-saver      # 停止
sudo journalctl -u luogu-judgement-saver -f    # 查看日志
```

---

## Nginx 反向代理（可选）

如果希望绑定域名或使用 HTTPS，可添加 Nginx 反向代理：

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/luogu-judgement
```

```nginx
server {
    listen 80;
    server_name judgement.example.com;   # 替换为你的域名

    location / {
        proxy_pass http://127.0.0.1:3457;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/luogu-judgement /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 使用 Certbot 申请 HTTPS 证书（可选）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d judgement.example.com
```

---

## API 文档

所有 API 返回 JSON 格式。

### GET /api/judgement

获取 judgement 记录。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码 |
| `limit` | int | 50 | 每页条数（最大 500） |
| `uid` | int | — | 按用户 UID 筛选 |
| `name` | string | — | 按用户名模糊筛选 |
| `rev_perm` | int[] | — | 按移除的权限值筛选（逗号分隔，AND 逻辑） |
| `add_perm` | int[] | — | 按添加的权限值筛选（逗号分隔，AND 逻辑） |

示例响应：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "uid": 1006023,
      "name": "lichenxi108",
      "reason": "根据用户申请（#YBYC117832）进行调整",
      "revoked_permission": 32768,
      "added_permission": 0,
      "time": 1782727440,
      "user": { "uid": 1006023, "name": "lichenxi108", ... },
      "full_record": { ... },
      "fetch_log_id": 1,
      "log_fetched_at": "2026-06-29 18:38:03",
      "created_at": "2026-06-29 18:38:03"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "total_pages": 10
  }
}
```

### GET /api/logs

获取抓取日志。

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码 |
| `limit` | int | 50 | 每页条数（最大 500） |

### GET /api/stats

获取统计信息（总记录数、总抓取次数）。

```json
{
  "success": true,
  "data": {
    "total_judgements": 500,
    "total_fetch_logs": 1
  }
}
```

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 前端页面（默认显示 judgement） |
| `/judgement` | 直接跳转至 judgement 记录页 |
| `/logs` | 直接跳转至抓取日志页 |

## License

AGPL-3.0

