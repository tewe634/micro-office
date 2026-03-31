#!/usr/bin/env node
const XLSX = require('xlsx');
const { Client } = require('pg');

const db = new Client({ host:'localhost', port:5432, database:'micro_office', user:'postgres', password:'postgres' });

async function main() {
  const wb = XLSX.readFile('/mnt/c/Users/user/Downloads/银行信息.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header:1, defval:'' }).slice(1);

  // 合并多行：以公司名称+科目编号为key，K宝操作和保管员合并
  const banks = {};
  let lastKey = null;
  for (const r of rows) {
    const [company, subjectCode, subjectName, accountNo, kbaoOp, keeper, remark] = r;
    if (company) {
      lastKey = `${company}||${subjectCode}||${accountNo.toString().trim()}`;
      banks[lastKey] = { company, subjectCode, subjectName, accountNo: accountNo.toString().trim(), keepers: new Set(), kbaoOps: [] };
    }
    if (!lastKey) continue;
    const b = banks[lastKey];
    if (keeper) b.keepers.add(keeper.toString().trim());
    if (kbaoOp) b.kbaoOps.push(`${kbaoOp.toString().trim()}${remark ? '('+remark+')' : ''}`);
  }

  await db.connect();
  let count = 0;
  for (const b of Object.values(banks)) {
    const name = `${b.company} - ${b.subjectName}`;
    const contact = [...b.keepers].join('、');
    const remarkText = b.kbaoOps.join('；');
    await db.query(
      `INSERT INTO external_object (type, name, contact, account_no, subject_code, remark)
       VALUES ('BANK', $1, $2, $3, $4, $5)`,
      [name, contact, b.accountNo, b.subjectCode, remarkText]
    );
    count++;
  }
  console.log(`✓ 导入 ${count} 条银行账户`);
  await db.end();
}

main().catch(e => { console.error(e); process.exit(1); });
