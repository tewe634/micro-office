#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${MICRO_OFFICE_BASE_URL:-http://127.0.0.1:8080/api}"
ADMIN_LOGIN="${MICRO_OFFICE_ADMIN_LOGIN:-13305713391}"
ADMIN_PASSWORD="${MICRO_OFFICE_ADMIN_PASSWORD:-123456}"

TEST_NAME="${MICRO_OFFICE_TEST_NAME:-qa-multi-position}"
TEST_EMAIL="${MICRO_OFFICE_TEST_EMAIL:-qa.multi.position.$(date +%s)@example.com}"
TEST_PHONE="${MICRO_OFFICE_TEST_PHONE:-199$(date +%s | tail -c 9)}"
TEST_PASSWORD="${MICRO_OFFICE_TEST_PASSWORD:-MpTest123!}"
TEST_ROLE="${MICRO_OFFICE_TEST_ROLE:-}"

TEST_ORG_ID="${MICRO_OFFICE_TEST_ORG_ID:-}"
TEST_ORG_NAME="${MICRO_OFFICE_TEST_ORG_NAME:-}"
TEST_PRIMARY_POSITION_ID="${MICRO_OFFICE_TEST_PRIMARY_POSITION_ID:-}"
TEST_PRIMARY_POSITION_CODE="${MICRO_OFFICE_TEST_PRIMARY_POSITION_CODE:-}"
TEST_PRIMARY_POSITION_NAME="${MICRO_OFFICE_TEST_PRIMARY_POSITION_NAME:-}"
TEST_EXTRA_POSITION_IDS="${MICRO_OFFICE_TEST_EXTRA_POSITION_IDS:-}"
TEST_EXTRA_POSITION_CODES="${MICRO_OFFICE_TEST_EXTRA_POSITION_CODES:-}"
TEST_EXTRA_POSITION_NAMES="${MICRO_OFFICE_TEST_EXTRA_POSITION_NAMES:-}"

RUN_ID="mp-smoke-$(date +%Y%m%d%H%M%S)"
REQUEST_STATUS=""
REQUEST_BODY=""

log() {
  printf '[multi-position-smoke] %s\n' "$*"
}

die() {
  printf '[multi-position-smoke] ERROR: %s\n' "$*" >&2
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

json_query() {
  local path="$1"
  node -e '
    const fs = require("fs");
    const path = (process.argv[1] || "").split(".").filter(Boolean);
    const raw = fs.readFileSync(0, "utf8");
    let value = raw.trim() ? JSON.parse(raw) : null;
    for (const key of path) {
      if (value === undefined || value === null) break;
      if (Array.isArray(value) && /^\d+$/.test(key)) value = value[Number(key)];
      else value = value[key];
    }
    if (value === undefined) process.exit(3);
    process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
  ' "$path"
}

json_find_by_field() {
  local field="$1"
  local expected="$2"
  node -e '
    const fs = require("fs");
    const field = process.argv[1];
    const expected = process.argv[2];
    const input = fs.readFileSync(0, "utf8").trim();
    const rows = input ? JSON.parse(input) : [];
    const row = rows.find((item) => String(item?.[field]) === expected);
    if (!row) process.exit(4);
    process.stdout.write(JSON.stringify(row));
  ' "$field" "$expected"
}

json_array_to_csv() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0, "utf8").trim();
    const arr = input ? JSON.parse(input) : [];
    process.stdout.write((arr || []).join(","));
  '
}

request() {
  local method="$1"
  local route="$2"
  local body="${3-}"
  local token="${4-}"
  local tmp
  local url="${BASE_URL%/}${route}"
  tmp="$(mktemp)"

  local -a curl_args=(
    curl
    -sS
    -o "$tmp"
    -w '%{http_code}'
    -X "$method"
    "$url"
    -H 'Accept: application/json'
  )

  if [[ -n "$token" ]]; then
    curl_args+=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$body" ]]; then
    curl_args+=(-H 'Content-Type: application/json' --data "$body")
  fi

  REQUEST_STATUS="$("${curl_args[@]}")"
  REQUEST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

api() {
  local method="$1"
  local route="$2"
  local body="${3-}"
  local token="${4-}"
  request "$method" "$route" "$body" "$token"

  if [[ ! "$REQUEST_STATUS" =~ ^2 ]]; then
    printf '%s\n' "$REQUEST_BODY" >&2
    die "$method $route failed with HTTP $REQUEST_STATUS"
  fi

  local code
  code="$(printf '%s' "$REQUEST_BODY" | json_query 'code' 2>/dev/null || true)"
  if [[ -n "$code" && "$code" != "0" ]]; then
    printf '%s\n' "$REQUEST_BODY" >&2
    die "$method $route returned business code $code"
  fi
}

lookup_id_by_field() {
  local rows_json="$1"
  local field="$2"
  local expected="$3"
  printf '%s' "$rows_json" | json_find_by_field "$field" "$expected" | json_query 'id'
}

build_login_body() {
  local login_value="$1"
  local password="$2"
  LOGIN_VALUE="$login_value" LOGIN_PASSWORD="$password" node - <<'NODE'
const body = {
  email: process.env.LOGIN_VALUE,
  password: process.env.LOGIN_PASSWORD,
};
process.stdout.write(JSON.stringify(body));
NODE
}

build_user_body() {
  RESOLVED_EXTRA_POSITION_IDS_CSV="$1" node - <<'NODE'
const extraIds = (process.env.RESOLVED_EXTRA_POSITION_IDS_CSV || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const body = {
  name: process.env.TEST_NAME,
  email: process.env.TEST_EMAIL,
  phone: process.env.TEST_PHONE,
  password: process.env.TEST_PASSWORD,
  orgId: process.env.RESOLVED_ORG_ID,
  primaryPositionId: process.env.RESOLVED_PRIMARY_POSITION_ID,
  extraPositionIds: extraIds,
};

if (process.env.TEST_ROLE) body.role = process.env.TEST_ROLE;
process.stdout.write(JSON.stringify(body));
NODE
}

build_object_body() {
  local object_type="$1"
  OBJECT_TYPE="$object_type" node - <<'NODE'
const type = process.env.OBJECT_TYPE;
const body = {
  type,
  name: `${process.env.RUN_ID}-${type.toLowerCase()}`,
  contact: 'Smoke Owner',
  phone: '4000000000',
  remark: 'created by multi-position smoke',
  ownerId: process.env.CREATED_USER_ID,
};
if (type === 'CUSTOMER') body.industry = 'Manufacturing';
process.stdout.write(JSON.stringify(body));
NODE
}

build_product_body() {
  node - <<'NODE'
const body = {
  name: `${process.env.RUN_ID}-product`,
  code: `${process.env.RUN_ID.toUpperCase()}-PRD`,
  spec: 'multi-position smoke',
  price: 88.8,
  productLine: 'ABB',
  categoryCode: 'MP-SMOKE',
};
process.stdout.write(JSON.stringify(body));
NODE
}

read_csv_values() {
  local input="$1"
  local -n target_ref="$2"
  local item
  IFS=',' read -r -a raw_items <<< "$input"
  for item in "${raw_items[@]}"; do
    item="$(trim "$item")"
    [[ -n "$item" ]] && target_ref+=("$item")
  done
}

log "using ${BASE_URL}"

login_body="$(build_login_body "$ADMIN_LOGIN" "$ADMIN_PASSWORD")"
api POST '/auth/login' "$login_body"
ADMIN_TOKEN="$(printf '%s' "$REQUEST_BODY" | json_query 'data.token')"
ADMIN_ROLE="$(printf '%s' "$REQUEST_BODY" | json_query 'data.role')"
[[ "$ADMIN_ROLE" == "ADMIN" ]] || die "admin login did not return ADMIN role"

api GET '/orgs' '' "$ADMIN_TOKEN"
ORGS_JSON="$(printf '%s' "$REQUEST_BODY" | json_query 'data')"

api GET '/positions' '' "$ADMIN_TOKEN"
POSITIONS_JSON="$(printf '%s' "$REQUEST_BODY" | json_query 'data')"

if [[ -n "$TEST_ORG_ID" ]]; then
  RESOLVED_ORG_ID="$TEST_ORG_ID"
elif [[ -n "$TEST_ORG_NAME" ]]; then
  RESOLVED_ORG_ID="$(lookup_id_by_field "$ORGS_JSON" 'name' "$TEST_ORG_NAME" || true)"
  [[ -n "$RESOLVED_ORG_ID" ]] || die "org name not found: $TEST_ORG_NAME"
else
  die "set MICRO_OFFICE_TEST_ORG_ID or MICRO_OFFICE_TEST_ORG_NAME"
fi

if [[ -n "$TEST_PRIMARY_POSITION_ID" ]]; then
  RESOLVED_PRIMARY_POSITION_ID="$TEST_PRIMARY_POSITION_ID"
elif [[ -n "$TEST_PRIMARY_POSITION_CODE" ]]; then
  RESOLVED_PRIMARY_POSITION_ID="$(lookup_id_by_field "$POSITIONS_JSON" 'code' "$TEST_PRIMARY_POSITION_CODE" || true)"
  [[ -n "$RESOLVED_PRIMARY_POSITION_ID" ]] || die "primary position code not found: $TEST_PRIMARY_POSITION_CODE"
elif [[ -n "$TEST_PRIMARY_POSITION_NAME" ]]; then
  RESOLVED_PRIMARY_POSITION_ID="$(lookup_id_by_field "$POSITIONS_JSON" 'name' "$TEST_PRIMARY_POSITION_NAME" || true)"
  [[ -n "$RESOLVED_PRIMARY_POSITION_ID" ]] || die "primary position name not found: $TEST_PRIMARY_POSITION_NAME"
else
  die "set one of MICRO_OFFICE_TEST_PRIMARY_POSITION_ID / _CODE / _NAME"
fi

declare -a EXTRA_POSITION_ID_LIST=()
declare -A EXTRA_POSITION_ID_SEEN=()

add_extra_position_id() {
  local id
  id="$(trim "$1")"
  [[ -n "$id" ]] || return 0
  [[ "$id" == "$RESOLVED_PRIMARY_POSITION_ID" ]] && return 0
  if [[ -z "${EXTRA_POSITION_ID_SEEN[$id]:-}" ]]; then
    EXTRA_POSITION_ID_SEEN["$id"]=1
    EXTRA_POSITION_ID_LIST+=("$id")
  fi
}

if [[ -n "$TEST_EXTRA_POSITION_IDS" ]]; then
  declare -a raw_extra_ids=()
  read_csv_values "$TEST_EXTRA_POSITION_IDS" raw_extra_ids
  for item in "${raw_extra_ids[@]}"; do
    add_extra_position_id "$item"
  done
fi

if [[ -n "$TEST_EXTRA_POSITION_CODES" ]]; then
  declare -a raw_extra_codes=()
  read_csv_values "$TEST_EXTRA_POSITION_CODES" raw_extra_codes
  for item in "${raw_extra_codes[@]}"; do
    resolved_id="$(lookup_id_by_field "$POSITIONS_JSON" 'code' "$item" || true)"
    [[ -n "$resolved_id" ]] || die "extra position code not found: $item"
    add_extra_position_id "$resolved_id"
  done
fi

if [[ -n "$TEST_EXTRA_POSITION_NAMES" ]]; then
  declare -a raw_extra_names=()
  read_csv_values "$TEST_EXTRA_POSITION_NAMES" raw_extra_names
  for item in "${raw_extra_names[@]}"; do
    resolved_id="$(lookup_id_by_field "$POSITIONS_JSON" 'name' "$item" || true)"
    [[ -n "$resolved_id" ]] || die "extra position name not found: $item"
    add_extra_position_id "$resolved_id"
  done
fi

RESOLVED_EXTRA_POSITION_IDS_CSV=""
if [[ ${#EXTRA_POSITION_ID_LIST[@]} -gt 0 ]]; then
  RESOLVED_EXTRA_POSITION_IDS_CSV="$(IFS=,; printf '%s' "${EXTRA_POSITION_ID_LIST[*]}")"
fi

export TEST_NAME TEST_EMAIL TEST_PHONE TEST_PASSWORD TEST_ROLE
export RESOLVED_ORG_ID RESOLVED_PRIMARY_POSITION_ID RUN_ID

user_body="$(build_user_body "$RESOLVED_EXTRA_POSITION_IDS_CSV")"
api POST '/users' "$user_body" "$ADMIN_TOKEN"
CREATED_USER_ID="$(printf '%s' "$REQUEST_BODY" | json_query 'data.id')"
export CREATED_USER_ID

log "created user ${CREATED_USER_ID}"

api GET "/users?orgId=${RESOLVED_ORG_ID}" '' "$ADMIN_TOKEN"
USER_LIST_JSON="$(printf '%s' "$REQUEST_BODY" | json_query 'data')"
CREATED_USER_ROW="$(printf '%s' "$USER_LIST_JSON" | json_find_by_field 'id' "$CREATED_USER_ID")"
USER_EXTRA_POSITION_IDS="$(printf '%s' "$CREATED_USER_ROW" | json_query 'extraPositionIds' 2>/dev/null || printf '[]')"
log "user list extraPositionIds=$(printf '%s' "$USER_EXTRA_POSITION_IDS" | json_array_to_csv)"

login_body="$(build_login_body "$TEST_EMAIL" "$TEST_PASSWORD")"
api POST '/auth/login' "$login_body"
TEST_TOKEN="$(printf '%s' "$REQUEST_BODY" | json_query 'data.token')"

api GET '/users/me' '' "$TEST_TOKEN"
USER_ME_JSON="$(printf '%s' "$REQUEST_BODY" | json_query 'data')"
USER_ROLE="$(printf '%s' "$USER_ME_JSON" | json_query 'role')"
USER_OBJECT_TYPES_JSON="$(printf '%s' "$USER_ME_JSON" | json_query 'objectTypes' 2>/dev/null || printf '[]')"
USER_OBJECT_TYPES_CSV="$(printf '%s' "$USER_OBJECT_TYPES_JSON" | json_array_to_csv)"
log "users/me role=${USER_ROLE}"
log "users/me objectTypes=${USER_OBJECT_TYPES_CSV:-<empty>}"

api GET "/portal/users/${CREATED_USER_ID}" '' "$ADMIN_TOKEN"
USER_PORTAL_VARIANT="$(printf '%s' "$REQUEST_BODY" | json_query 'data.variant')"
log "user portal variant=${USER_PORTAL_VARIANT}"

FIRST_OBJECT_ID=""
if [[ -n "$USER_OBJECT_TYPES_CSV" ]]; then
  declare -a OBJECT_TYPES_TO_CREATE=()
  read_csv_values "$USER_OBJECT_TYPES_CSV" OBJECT_TYPES_TO_CREATE

  for object_type in "${OBJECT_TYPES_TO_CREATE[@]}"; do
    object_body="$(build_object_body "$object_type")"
    api POST '/objects' "$object_body" "$ADMIN_TOKEN"
    created_object_id="$(printf '%s' "$REQUEST_BODY" | json_query 'data.id')"
    [[ -n "$FIRST_OBJECT_ID" ]] || FIRST_OBJECT_ID="$created_object_id"

    api GET "/objects/page?current=1&size=20&type=${object_type}&name=${RUN_ID}" '' "$TEST_TOKEN"
    OBJECT_PAGE_JSON="$(printf '%s' "$REQUEST_BODY" | json_query 'data.records')"
    printf '%s' "$OBJECT_PAGE_JSON" | json_find_by_field 'id' "$created_object_id" >/dev/null
    log "verified object type ${object_type} with object ${created_object_id}"
  done
else
  log "no objectTypes returned for test user; skipping object visibility checks"
fi

if [[ -n "$FIRST_OBJECT_ID" ]]; then
  api GET "/portal/objects/${FIRST_OBJECT_ID}" '' "$TEST_TOKEN"
  OBJECT_PORTAL_VARIANT="$(printf '%s' "$REQUEST_BODY" | json_query 'data.variant')"
  log "object portal variant=${OBJECT_PORTAL_VARIANT}"
fi

product_body="$(build_product_body)"
api POST '/products' "$product_body" "$ADMIN_TOKEN"
CREATED_PRODUCT_ID="$(printf '%s' "$REQUEST_BODY" | json_query 'data.id')"
api GET "/portal/products/${CREATED_PRODUCT_ID}" '' "$TEST_TOKEN"
PRODUCT_PORTAL_VARIANT="$(printf '%s' "$REQUEST_BODY" | json_query 'data.variant')"
log "product portal variant=${PRODUCT_PORTAL_VARIANT}"

request GET '/dashboard/scopes' '' "$TEST_TOKEN"
if [[ "$REQUEST_STATUS" != "200" ]]; then
  log "warning: /dashboard/scopes returned HTTP ${REQUEST_STATUS}; scope aggregation is not available in current backend"
else
  SCOPE_KEYS="$(printf '%s' "$REQUEST_BODY" | json_query 'data' | node -e 'const fs=require("fs"); const rows=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write((rows||[]).map((item)=>item.key).join(","));')"
  log "dashboard scopes=${SCOPE_KEYS:-<empty>}"
fi

log "done"
log "keep these resources for follow-up checks:"
log "userEmail=${TEST_EMAIL}"
log "userPhone=${TEST_PHONE}"
log "userPassword=${TEST_PASSWORD}"
log "userId=${CREATED_USER_ID}"
log "productId=${CREATED_PRODUCT_ID}"
if [[ -n "$FIRST_OBJECT_ID" ]]; then
  log "sampleObjectId=${FIRST_OBJECT_ID}"
fi
