const XLSX = require('xlsx');
const { Client } = require('pg');

const db = new Client({ host: 'localhost', port: 5432, database: 'micro_office', user: 'postgres', password: 'postgres' });

const ORG_ID = 'c4d992b5-9599-4676-95af-a6648e0c5c3f'; // 业务一部
const DEPT_ID = '87f228a2-9858-4f1b-84c8-bc4796c569ba'; // 杭州1-彭和春

const rows = XLSX.utils.sheet_to_json(
  XLSX.readFile('/mnt/c/Users/user/Downloads/基础信息-部分.xlsx').Sheets['东华-杭州1彭和春组客户信息'],
  { header: 1, defval: '' }
).slice(1).filter(r => r[2]);

db.connect().then(async () => {
  // 查业务员 name->id 映射
  const users = await db.query("SELECT id, name FROM sys_user WHERE name IN ('王忠','伊志杰','彭和春')");
  const userMap = Object.fromEntries(users.rows.map(u => [u.name, u.id]));

  let count = 0;
  for (const r of rows) {
    const name = String(r[2]).trim();
    const address = String(r[8]).trim();
    const contact = String(r[10]).trim();
    const phone = String(r[11]).trim();
    const salesman = String(r[14]).trim();
    const industry = String(r[15]).trim();
    const ownerId = userMap[salesman] || null;

    await db.query(
      `INSERT INTO external_object (type, name, address, contact, phone, industry, org_id, owner_id)
       VALUES ('CUSTOMER', $1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [name, address || null, contact || null, phone || null, industry || null, ORG_ID, ownerId]
    );
    count++;
  }
  console.log(`✓ 导入 ${count} 条客户`);
  await db.end();
});
