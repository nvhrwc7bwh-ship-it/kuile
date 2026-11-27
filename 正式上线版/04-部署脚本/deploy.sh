#!/bin/bash
# ============================================================================
# 亏了 · 正式上线版 · 一键部署脚本
# ----------------------------------------------------------------------------
# 【小白须知】这个脚本会帮你完成：
#   1. 把后端代码传到服务器
#   2. 安装依赖
#   3. 初始化数据库
#   4. 用 PM2 启动服务（PM2 是个「进程管家」，服务器重启会自动拉起服务）
#   5. 配置 Nginx 并重载
#
# 【怎么用】
#   在服务器上执行：
#     cd /var/www/kuile/正式上线版/04-部署脚本
#     chmod +x deploy.sh
#     ./deploy.sh
#
# 【前提】
#   · 服务器已装好 Node.js 18+、Nginx
#   · MySQL 8.0 已装好并启动（见《上线执行清单》第 4 章「自建数据库」）
#   · 代码已上传到服务器（见《上线执行清单》3.4 上传代码到服务器）
#   · .env 已填好
# ============================================================================

set -e   # 任何一步出错就停下，不继续瞎跑

# ---------------------------------------------------------------------------
# 配置区
# ---------------------------------------------------------------------------
APP_NAME="kuile-api"

# 【REPO_DIR】代码仓库的根目录 —— git clone 的目标
# 【APP_DIR】项目目录（含 02-后端 / 04-部署脚本 这些子目录）
#
#   /var/www/kuile/                 ← REPO_DIR（仓库根）
#   └── 正式上线版/                  ← APP_DIR
#       ├── 02-后端/
#       ├── 03-小程序前端/
#       ├── 04-部署脚本/
#       └── 05-上线执行清单/
#
# 【为什么要分两个变量】
#   git clone 出来的是「整个仓库」，仓库里才有「正式上线版」这一层。
#   所以「代码放哪」（仓库根）和「后端在哪」（项目目录）是两个不同的位置。
REPO_DIR="/var/www/kuile"
APP_DIR="$REPO_DIR/正式上线版"

REPO_URL=""            # ← 你的代码仓库地址（GitHub / Gitee / Coding）
BRANCH="main"          # ← 分支名
NODE_ENV="production"

echo ""
echo "════════════════════════════════════════"
echo "  亏了 · 后端部署"
echo "════════════════════════════════════════"
echo ""

# ---------------------------------------------------------------------------
# 1. 检查必要命令
# ---------------------------------------------------------------------------
echo "▶ 第 1 步：检查环境"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 没找到 node，请先安装 Node.js 18 或更高版本"
  echo "  安装命令（Ubuntu）：curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
NODE_VER=$(node -v)
echo "  ✓ Node.js $NODE_VER"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "  · 正在安装 PM2…"
  npm install -g pm2
fi
echo "  ✓ PM2 $(pm2 -v)"

if ! command -v nginx >/dev/null 2>&1; then
  echo "  ⚠ 没找到 nginx —— 部署会继续，但反向代理需要你手动配置"
else
  echo "  ✓ Nginx 已安装"
fi

# ---- MySQL（自建）----
# 【为什么这里要检查】
#   本项目用【自建 MySQL 8.0】，不是腾讯云托管数据库。
#   数据库跑在这台服务器上，只监听 127.0.0.1，不对公网开放。
#   好处：不需要配数据库安全组，少一个攻击面，也少一个最容易配错的地方。
if ! command -v mysql >/dev/null 2>&1; then
  echo "  ⚠ 没找到 mysql 客户端"
  echo "    安装：sudo apt-get install -y mysql-client"
  echo "    （服务器还没有 MySQL 服务端的话，见《上线执行清单》第 4 章）"
else
  echo "  ✓ MySQL 客户端 $(mysql --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
  # 检查服务是否在跑
  if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
    echo "  ✓ MySQL 服务运行中"
  else
    echo "  ⚠ MySQL 服务没有运行，请执行：sudo systemctl start mysql"
  fi
fi

# ---------------------------------------------------------------------------
# 2. 拉取代码
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 2 步：获取代码"

if [ -z "$REPO_URL" ]; then
  # 没填仓库地址 —— 认为代码已经手动传上来了（3.4 节的拖拽方式）
  if [ -d "$APP_DIR" ]; then
    echo "  · 使用已有目录 $APP_DIR"
  else
    echo "✗ 请在脚本顶部填写 REPO_URL，或先把代码上传到 $APP_DIR"
    echo "  （上传方式见《上线执行清单》3.4 上传代码到服务器）"
    exit 1
  fi
else
  if [ -d "$REPO_DIR/.git" ]; then
    echo "  · 更新已有代码…"
    cd "$REPO_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
  else
    echo "  · 克隆代码…"
    git clone -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
  fi
fi

# 进到项目目录（里面有 02-后端 / 04-部署脚本）
cd "$APP_DIR"
if [ ! -d "02-后端" ]; then
  echo "✗ $APP_DIR 下找不到 02-后端 目录"
  echo "  请检查脚本顶部的 APP_DIR 配置（当前：$APP_DIR）"
  exit 1
fi

cd "$APP_DIR/02-后端"

# ---------------------------------------------------------------------------
# 3. 安装依赖
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 3 步：安装依赖"
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
echo "  ✓ 依赖安装完成"

# ---------------------------------------------------------------------------
# 4. 检查 .env
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 4 步：检查配置"
if [ ! -f ".env" ]; then
  echo "✗ 缺少 .env 文件"
  echo "  请执行：cp .env.example .env 然后填写里面的密钥"
  exit 1
fi
# 设置只有本人可读写
chmod 600 .env
echo "  ✓ .env 存在"

# ---------------------------------------------------------------------------
# 4.5 检查数据库连通性（提前失败，好过跑到一半才挂）
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 4.5 步：检查数据库连接"
node -e "
const config = require('./src/config');
const mysql = require('mysql2/promise');
(async () => {
  try {
    const c = await mysql.createConnection({
      host: config.db.host, port: config.db.port,
      user: config.db.user, password: config.db.password,
    });
    await c.query('SELECT 1');
    await c.end();
    console.log('  ✓ 数据库连接正常（' + config.db.host + ':' + config.db.port + '/' + config.db.database + '）');
  } catch (e) {
    console.log('  ✗ 数据库连不上：' + e.message);
    console.log('    请检查 .env 的 DB_HOST / DB_USER / DB_PASSWORD');
    console.log('    以及 MySQL 是否已启动：sudo systemctl status mysql');
    process.exit(1);
  }
});
"

# ---------------------------------------------------------------------------
# 5. 初始化数据库
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 5 步：初始化数据库"
node scripts/migrate.js
echo "  ✓ 数据库结构已就绪"

# ---------------------------------------------------------------------------
# 6. 启动服务
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 6 步：启动服务"

# 先停掉旧进程（如果有）
pm2 delete "$APP_NAME" 2>/dev/null || true

# 设置开机自启
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true

pm2 start src/server.js --name "$APP_NAME" --env "$NODE_ENV"
pm2 save
echo "  ✓ 服务已启动"

# ---------------------------------------------------------------------------
# 7. 配置 Nginx
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 7 步：配置 Nginx"

if command -v nginx >/dev/null 2>&1; then
  if [ -f "$APP_DIR/04-部署脚本/nginx-kuile.conf" ]; then
    cp "$APP_DIR/04-部署脚本/nginx-kuile.conf" /etc/nginx/conf.d/kuile.conf
    echo "  · 已复制 Nginx 配置（记得改里面的域名！）"
    nginx -t
    nginx -s reload
    echo "  ✓ Nginx 已重载"
  else
    echo "  · 找不到 nginx 配置文件，请手动复制"
  fi
fi

# ---------------------------------------------------------------------------
# 8. 验证
# ---------------------------------------------------------------------------
echo ""
echo "▶ 第 8 步：验证"
sleep 3
if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  echo "  ✓ 健康检查通过"
  curl -s http://127.0.0.1:3000/api/health
  echo ""
else
  echo "  ✗ 健康检查失败，看日志：pm2 logs $APP_NAME"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "  ✅ 部署完成"
echo ""
echo "  看日志：   pm2 logs $APP_NAME"
echo "  重启服务： pm2 restart $APP_NAME"
echo "  停止服务： pm2 stop $APP_NAME"
echo "  开机自启： pm2 startup && pm2 save"
echo ""
echo "  ⚠️ 还没做的："
echo "    1. 在微信公众平台配置 request 合法域名（api.你的域名）"
echo "    2. 在微信公众平台配置 uploadFile 合法域名"
echo "    3. 在微信支付商户平台配置支付回调地址"
echo "    4. 提交小程序审核"
echo "════════════════════════════════════════"
echo ""
