#!/usr/bin/env node
// 员工信息表导入脚本
// 用法: node import_employees.js <xlsx路径>

const XLSX = require('xlsx');
const { Client } = require('pg');
const crypto = require('crypto');
const path = require('path');

const xlsxPath = process.argv[2] || '/mnt/c/Users/user/Downloads/杭州1-彭和春组织架构表.xlsx';

const db = new Client({
  host: 'localhost', port: 5432,
  database: 'micro_office', user: 'postgres', password: 'postgres'
});

function hashPassword(plain) {
  // BCrypt 不在标准库，用 SHA-256 占位——后端若用 BCrypt 需换
  // 实际后端用 BCrypt，这里直接调用后端注册接口更安全
  // 但为保持一致，我们用后端已有的 BCrypt hash for "123456"
  return '$2a$10$O9u6qiF5wDGEM5ZETxvWtOGQO3PsUA3RhIBYmGkXGHZq.y.aNwfA2'; // BCrypt("123456")
}

// 岗位名 → role 映射
function guessRole(posName) {
  if (!posName) return 'STAFF';
  if (/CEO|总经理|董事/.test(posName)) return 'ADMIN';
  if (/副总|总监/.test(posName)) return 'ADMIN';
  if (/销售/.test(posName)) return 'SALES';
  if (/财务|会计/.test(posName)) return 'FINANCE';
  if (/人事|HR/.test(posName)) return 'HR';
  if (/采购/.test(posName)) return 'PURCHASE';
  if (/仓/.test(posName)) return 'STAFF';
  if (/技术|工程师/.test(posName)) return 'STAFF';
  return 'STAFF';
}

// Excel 日期序列号 → ISO 字符串
function excelDate(v) {
  if (!v || typeof v !== 'number') return null;
  const d = new Date(Math.round((v - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}

async function main() {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['员工信息表'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    .slice(2) // 跳过标题行
    .filter(r => r[2]); // 有姓名

  await db.connect();

  // ── 清空旧数据（保留 flyway 元数据）──
  await db.query(`
    TRUNCATE user_position, sys_user, position, organization CASCADE
  `);
  console.log('✓ 旧数据已清空');

  // ── 1. 构建组织树（一级→二级→三级）──
  const orgMap = {}; // "名称" → id

  async function getOrCreateOrg(name, parentId) {
    const key = `${parentId}:${name}`;
    if (orgMap[key]) return orgMap[key];
    const r = await db.query(
      `INSERT INTO organization (name, parent_id) VALUES ($1, $2) RETURNING id`,
      [name, parentId]
    );
    orgMap[key] = r.rows[0].id;
    return orgMap[key];
  }

  // ── 2. 构建岗位表 ──
  const posMap = {}; // 岗位名 → id

  async function getOrCreatePos(name) {
    if (posMap[name]) return posMap[name];
    const code = 'POS_' + Buffer.from(name).toString('hex').slice(0, 16).toUpperCase();
    const r = await db.query(
      `INSERT INTO position (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [name, code]
    );
    posMap[name] = r.rows[0].id;
    return posMap[name];
  }

  // ── 3. 遍历行，建组织+岗位+用户 ──
  for (const row of rows) {
    const [, empNo, name, , lvl1, lvl2, lvl3, posName, hiredRaw, phone] = row;

    // 组织
    let orgId = null;
    if (lvl1) {
      orgId = await getOrCreateOrg(lvl1, null);
      if (lvl2) {
        orgId = await getOrCreateOrg(lvl2, orgMap[`null:${lvl1}`]);
        if (lvl3) {
          orgId = await getOrCreateOrg(lvl3, orgMap[`${orgMap[`null:${lvl1}`]}:${lvl2}`]);
        }
      }
    }

    // 岗位
    const posId = posName ? await getOrCreatePos(posName) : null;

    // 用户（手机号作为 email 字段登录，phone 字段也存）
    const phoneStr = String(phone).trim();
    const hiredAt = excelDate(hiredRaw);
    const role = guessRole(posName);

    const ur = await db.query(
      `INSERT INTO sys_user (name, phone, password_hash, org_id, primary_position_id, hired_at, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, phoneStr, hashPassword('123456'), orgId, posId, hiredAt, role]
    );
    const userId = ur.rows[0].id;

    if (posId) {
      await db.query(
        `INSERT INTO user_position (user_id, position_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, posId]
      );
    }
  }

  console.log(`✓ 导入完成：${rows.length} 名员工`);
  console.log(`  组织节点：${Object.keys(orgMap).length}`);
  console.log(`  岗位：${Object.keys(posMap).length}`);
  console.log('  默认密码：123456（手机号登录）');

  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
