#!/bin/bash
# ============================================================================
# 亏了 · 正式上线版 · 数据库备份脚本
# ----------------------------------------------------------------------------
# 【小白须知】这个脚本做一件事：把 MySQL 的数据导出成一个 .sql.gz 文件，
#   存到本地，并【可选】上传到腾讯云 COS（异地）。
#
# 【为什么必须备份到「异地」】
#   自建 MySQL 的数据就在这台服务器的硬盘上。
#   如果备份也只存在这台机器上，那「盘坏了」= 数据和备份一起没了 = 备份白做。
#   所以备份必须多存一份到别的地方（这里用 COS —— 你已经有 COS 了，顺手）。
#
# 【怎么用】
#   1. 改下面的配置区（至少填 COS 的密钥和桶名）
#   2. chmod +x backup-db.sh
#   3. 手动跑一次测试：./backup-db.sh
#   4. 加到定时任务（每天凌晨 3:17 自动跑）：
#      crontab -e
#      17 3 * * * /var/www/kuile/正式上线版/04-部署脚本/backup-db.sh >> /var/log/kuile-backup.log 2>&1
#
# 【⚠️ 没验证过的备份等于没有备份】
#   跑通本脚本后，务必做一次【恢复演练】：
#   把备份文件恢复到一台临时机器上，跑几个 SELECT 确认数据完整。
#   见《上线执行清单》第 4 章「4.7 备份与恢复演练」。
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 配置区
# ---------------------------------------------------------------------------
BACKUP_DIR="/var/backups/kuile"
DB_NAME="kuile"
DB_USER="kuile"
DB_HOST="127.0.0.1"
DB_PORT="3306"

# 从 02-后端/.env 里读数据库密码（不硬编码在这里）
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/02-后端/.env"

# COS 上传配置（留空则只做本地备份）
COS_REGION="${COS_REGION:-ap-guangzhou}"
COS_BUCKET="${COS_BUCKET:-}"
COS_SECRET_ID="${COS_SECRET_ID:-}"
COS_SECRET_KEY="${COS_SECRET_KEY:-}"
COS_BACKUP_PREFIX="${COS_BACKUP_PREFIX:-backups/}"

# 本地保留天数（超过就删掉旧备份，避免磁盘被撑满）
KEEP_DAYS="${KEEP_DAYS:-7}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

# ---------------------------------------------------------------------------
# 准备
# ---------------------------------------------------------------------------
echo "▶ 亏了 · 数据库备份  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ 找不到 .env：$ENV_FILE"
  exit 1
fi

# 从 .env 里提取 DB_PASSWORD（避免密码出现在 ps 命令行里）
DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//')"
if [ -z "$DB_PASSWORD" ]; then
  echo "✗ .env 里没有 DB_PASSWORD"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ---------------------------------------------------------------------------
# 1. 检查 mysqldump 是否存在
# ---------------------------------------------------------------------------
if ! command -v mysqldump >/dev/null 2>&1; then
  echo "✗ 没找到 mysqldump，请先安装：sudo apt-get install -y mysql-client"
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. 导出并压缩
# ---------------------------------------------------------------------------
# 【为什么用 mysqldump 而不是直接 cp 数据文件】
#   mysqldump 不是复制二进制文件，而是把数据翻译成 SQL 语句
#   （CREATE TABLE + 一串 INSERT INTO）。
#   优点：可读、可跨版本、可以只导部分表、恢复时不会因为版本差异出问题。
#   缺点：数据量大时慢（而且导出期间若有写入，可能导出到「半个事务」的状态）。
#   本项目数据量小（内测期几十条），速度完全不是问题。
#
# 【--single-transaction 的作用】
#   InnoDB 引擎下，这个参数会用一个一致性快照导出，
#   **不会锁表**，导出期间线上照常读写。对生产库很重要。
#
# 【--routines --triggers --events】
#   一起导出存储过程、触发器、事件。本项目目前没用，但加上更保险。
echo "  · 导出数据库 $DB_NAME…"
mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines --triggers --events \
  --default-character-set=utf8mb4 \
  --set-gtid-purged=OFF \
  "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

# ---------------------------------------------------------------------------
# 3. 校验备份文件（空文件是失败的备份）
# ---------------------------------------------------------------------------
FILE_SIZE=$(stat -c%s "$BACKUP_FILE")
if [ "$FILE_SIZE" -lt 1024 ]; then
  echo "✗ 备份文件异常小（${FILE_SIZE} 字节），可能是空的，保留以便排查：$BACKUP_FILE"
  exit 1
fi
chmod 600 "$BACKUP_FILE"
echo "  ✓ 备份完成：$BACKUP_FILE（$(du -h "$BACKUP_FILE" | cut -f1)）"

# ---------------------------------------------------------------------------
# 4. 上传到 COS（异地）
# ---------------------------------------------------------------------------
if [ -n "$COS_BUCKET" ] && [ -n "$COS_SECRET_ID" ] && [ -n "$COS_SECRET_KEY" ]; then
  if command -v coscmd >/dev/null 2>&1; then
    echo "  · 上传到 COS…"
    coscmd config -a "$COS_SECRET_ID" -s "$COS_SECRET_KEY" -r "$COS_REGION" >/dev/null 2>&1 || true
    if coscmd upload "$BACKUP_FILE" "${COS_BUCKET}/${COS_BACKUP_PREFIX}" >/dev/null 2>&1; then
      echo "  ✓ 已上传到 COS：${COS_BUCKET}/${COS_BACKUP_PREFIX}"
    else
      echo "  ⚠ COS 上传失败（本地备份已生成，请检查 coscmd 配置）"
    fi
  else
    echo "  ⚠ 没装 coscmd，跳过 COS 上传"
    echo "    安装：pip3 install coscmd"
  fi
else
  echo "  · 未配置 COS，跳过异地上传（⚠️ 这样备份只在本机，不够安全）"
fi

# ---------------------------------------------------------------------------
# 5. 清理过期本地备份
# ---------------------------------------------------------------------------
echo "  · 清理 ${KEEP_DAYS} 天前的本地备份…"
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

echo "✅ 备份流程结束"
