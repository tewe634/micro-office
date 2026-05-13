#!/usr/bin/env bash
set -euo pipefail

# micro-office 线上部署脚本（47.111.167.198）
#
# 推荐用法：
#   SERVER_PASS='your_password' ./scripts/deploy-server-1988.sh
#
# 如果本机已配置 SSH key 且可直接登录：
#   ./scripts/deploy-server-1988.sh
#
# 可覆盖变量：
#   REMOTE_HOST / REMOTE_USER / REMOTE_DIR / REMOTE_DB_CONTAINER
#   EXPECTED_DB_HOST / EXPECTED_DB_PORT
#   SMOKE_LOGIN / SMOKE_PASSWORD

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-47.111.167.198}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/micro-office-1988}"
REMOTE_STAGE_DIR="${REMOTE_STAGE_DIR:-${REMOTE_DIR}.new}"
REMOTE_PREV_DIR="${REMOTE_PREV_DIR:-${REMOTE_DIR}.prev}"
REMOTE_DB_CONTAINER="${REMOTE_DB_CONTAINER:-prod-amd64-20260418-postgres-1}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-micro-office-1988}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.server.yml}"
EXPECTED_DB_HOST="${EXPECTED_DB_HOST:-host.docker.internal}"
EXPECTED_DB_PORT="${EXPECTED_DB_PORT:-5433}"
SMOKE_LOGIN="${SMOKE_LOGIN:-13305713391}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-123456}"

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=15
)
REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
ASKPASS_SCRIPT=""
TMP_DIR=""
ARCHIVE_PATH=""
ARCHIVE_NAME=""

cleanup() {
  if [[ -n "$ASKPASS_SCRIPT" && -f "$ASKPASS_SCRIPT" ]]; then
    rm -f "$ASKPASS_SCRIPT"
  fi
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: 缺少命令 $1" >&2
    exit 1
  }
}

setup_auth() {
  if ssh "${SSH_OPTS[@]}" -o BatchMode=yes "$REMOTE_TARGET" 'true' >/dev/null 2>&1; then
    log "检测到可直接使用 SSH key 登录 $REMOTE_TARGET"
    return
  fi

  if [[ -z "${SERVER_PASS:-}" ]]; then
    cat >&2 <<EOF
ERROR: 当前无法免密登录 $REMOTE_TARGET，请通过环境变量提供服务器密码，例如：
  SERVER_PASS='your_password' ./scripts/deploy-server-1988.sh
EOF
    exit 1
  fi

  ASKPASS_SCRIPT="$(mktemp)"
  cat > "$ASKPASS_SCRIPT" <<EOF
#!/bin/sh
echo "$SERVER_PASS"
EOF
  chmod 700 "$ASKPASS_SCRIPT"
  log "将使用临时 SSH_ASKPASS 方式连接 $REMOTE_TARGET"
}

run_ssh() {
  if [[ -n "$ASKPASS_SCRIPT" ]]; then
    DISPLAY=:0 SSH_ASKPASS_REQUIRE=force SSH_ASKPASS="$ASKPASS_SCRIPT" \
      setsid ssh "${SSH_OPTS[@]}" "$REMOTE_TARGET" "$@" </dev/null
  else
    ssh "${SSH_OPTS[@]}" "$REMOTE_TARGET" "$@"
  fi
}

run_scp() {
  if [[ -n "$ASKPASS_SCRIPT" ]]; then
    DISPLAY=:0 SSH_ASKPASS_REQUIRE=force SSH_ASKPASS="$ASKPASS_SCRIPT" \
      setsid scp "${SSH_OPTS[@]}" "$@" </dev/null
  else
    scp "${SSH_OPTS[@]}" "$@"
  fi
}

check_local_state() {
  log "检查本地工作区状态"
  git -C "$WORKSPACE_ROOT" status --short -- micro-office || true
}

build_archive() {
  log "打包本地项目"
  TMP_DIR="$(mktemp -d)"
  ARCHIVE_NAME="micro-office-deploy-$(date +%Y%m%d-%H%M%S).tgz"
  ARCHIVE_PATH="$TMP_DIR/$ARCHIVE_NAME"

  tar -C "$ROOT_DIR" -czf "$ARCHIVE_PATH" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='backend/target' \
    --exclude='frontend/dist' \
    --exclude='docs/reports' \
    .

  ls -lh "$ARCHIVE_PATH"
}

verify_remote_env() {
  log "检查线上 .env.server 与真实数据源配置"
  run_ssh "set -e
cd '$REMOTE_DIR'
test -f .env.server
grep -E '^SPRING_DATASOURCE_URL=' .env.server
if ! grep -q '^SPRING_DATASOURCE_URL=jdbc:postgresql://$EXPECTED_DB_HOST:$EXPECTED_DB_PORT/' .env.server; then
  echo 'ERROR: .env.server 中 SPRING_DATASOURCE_URL 不是期望的真实线上库地址' >&2
  exit 1
fi"
}

backup_remote() {
  log "备份线上代码、.env.server 与真实业务数据库"
  run_ssh "set -e
mkdir -p /root/deploy-backups
TS=\$(date +%Y%m%d-%H%M%S)
tar -C /opt -czf /root/deploy-backups/micro-office-1988-code-\$TS.tgz \$(basename '$REMOTE_DIR')
cp '$REMOTE_DIR/.env.server' /root/deploy-backups/.env.server.\$TS
docker exec '$REMOTE_DB_CONTAINER' pg_dump -U postgres micro_office > /root/deploy-backups/micro-office-1988-db-\$TS.sql
ls -lh /root/deploy-backups/micro-office-1988-code-\$TS.tgz /root/deploy-backups/micro-office-1988-db-\$TS.sql /root/deploy-backups/.env.server.\$TS"
}

upload_and_prepare() {
  log "上传打包文件到线上"
  run_scp "$ARCHIVE_PATH" "$REMOTE_TARGET:/tmp/$ARCHIVE_NAME"

  log "准备线上发布目录"
  run_ssh "set -e
rm -rf '$REMOTE_STAGE_DIR'
mkdir -p '$REMOTE_STAGE_DIR'
tar -xzf '/tmp/$ARCHIVE_NAME' -C '$REMOTE_STAGE_DIR'
cp '$REMOTE_DIR/.env.server' '$REMOTE_STAGE_DIR/.env.server'
rm -f '/tmp/$ARCHIVE_NAME'"
}

apply_extra_sql_if_present() {
  log "应用额外兼容 SQL（如存在）"
  run_ssh "set -e
cd '$REMOTE_STAGE_DIR'
for sql in \
  scripts/sql/fix_workflow_template_package_position_id_compat.sql \
  scripts/sql/fix_workflow_template_scene_category_nullable.sql
 do
  if [ -f \"\$sql\" ]; then
    echo \"Applying optional SQL: \$sql\"
    docker exec -i '$REMOTE_DB_CONTAINER' psql -U postgres -d micro_office < \"\$sql\" || true
  fi
 done"
}

compose_up() {
  log "重建并启动线上容器"
  run_ssh "set -e
docker compose -p '$COMPOSE_PROJECT' -f '$REMOTE_STAGE_DIR/$COMPOSE_FILE' --env-file '$REMOTE_STAGE_DIR/.env.server' up --build -d"
}

verify_deploy() {
  log "执行部署后验收"
  run_ssh "set -e
docker compose -p '$COMPOSE_PROJECT' -f '$REMOTE_STAGE_DIR/$COMPOSE_FILE' --env-file '$REMOTE_STAGE_DIR/.env.server' ps
echo '---'
ACTUAL_DB_URL=\$(docker exec ${COMPOSE_PROJECT}-backend-1 env | grep '^SPRING_DATASOURCE_URL=' | sed 's/^SPRING_DATASOURCE_URL=//')
echo \"SPRING_DATASOURCE_URL=\$ACTUAL_DB_URL\"
if [[ \"\$ACTUAL_DB_URL\" != jdbc:postgresql://$EXPECTED_DB_HOST:$EXPECTED_DB_PORT/* ]]; then
  echo 'ERROR: backend 实际数据源不是期望的真实线上库地址' >&2
  exit 1
fi
echo '---'
docker exec ${COMPOSE_PROJECT}-backend-1 getent hosts '$EXPECTED_DB_HOST'
echo '---'
curl -I -sS http://127.0.0.1/ | head -n 5
echo '---'
HTTP_CODE=\$(curl -sS -o /tmp/micro-office-login.out -w '%{http_code}' http://127.0.0.1/api/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d '{\"login\":\"$SMOKE_LOGIN\",\"password\":\"$SMOKE_PASSWORD\"}')
echo \"LOGIN_HTTP_CODE=\$HTTP_CODE\"
head -c 400 /tmp/micro-office-login.out; echo
if [[ \"\$HTTP_CODE\" != '200' ]]; then
  echo 'ERROR: 登录接口探活失败' >&2
  exit 1
fi"
}

swap_release_dir() {
  log "切换线上项目目录，并保留上一版目录"
  run_ssh "set -e
rm -rf '$REMOTE_PREV_DIR'
if [ -d '$REMOTE_DIR' ]; then
  mv '$REMOTE_DIR' '$REMOTE_PREV_DIR'
fi
mv '$REMOTE_STAGE_DIR' '$REMOTE_DIR'"
}

main() {
  need_cmd git
  need_cmd ssh
  need_cmd scp
  need_cmd tar
  need_cmd setsid

  setup_auth
  check_local_state
  build_archive
  verify_remote_env
  backup_remote
  upload_and_prepare
  apply_extra_sql_if_present
  compose_up
  verify_deploy
  swap_release_dir

  log "部署完成"
  echo "线上地址: http://$REMOTE_HOST"
  echo "线上目录: $REMOTE_DIR"
  echo "上一版目录: $REMOTE_PREV_DIR"
}

main "$@"
