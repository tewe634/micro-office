const XLSX = require('xlsx');
const { Client } = require('pg');

const FILE_PATH = process.env.FILE_PATH || '/mnt/c/Users/user/Downloads/基础信息-部分.xlsx';
const SHEET_NAME = process.env.SHEET_NAME || '东华-杭州1彭和春组客户信息';
const ORG_ID = process.env.ORG_ID || 'c4d992b5-9599-4676-95af-a6648e0c5c3f'; // 业务一部
const APPLY = process.argv.includes('--apply') || process.env.APPLY === '1';

const db = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'micro_office',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function loadSheetRows() {
  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`未找到工作表：${SHEET_NAME}`);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) {
    throw new Error('Excel 工作表为空');
  }

  const header = (rows[0] || []).map(normalize);
  const indexOf = (name) => {
    const idx = header.indexOf(name);
    if (idx < 0) {
      throw new Error(`缺少列：${name}`);
    }
    return idx;
  };

  return {
    dataRows: rows.slice(1),
    nameIdx: indexOf('单位名称'),
    customerTypeIdx: indexOf('客户类型'),
    customerAttrIdx: indexOf('客户属性'),
  };
}

function buildPlans(dataRows, nameIdx, customerTypeIdx, customerAttrIdx) {
  const byName = new Map();

  for (const row of dataRows) {
    const name = normalize(row[nameIdx]);
    if (!name) continue;

    const rawCustomerType = normalize(row[customerTypeIdx]);
    const rawCustomerAttr = normalize(row[customerAttrIdx]);

    let record = byName.get(name);
    if (!record) {
      record = {
        name,
        rawCustomerTypes: new Set(),
        rawCustomerAttrs: new Set(),
        rowCount: 0,
      };
      byName.set(name, record);
    }

    record.rowCount += 1;
    if (rawCustomerType) record.rawCustomerTypes.add(rawCustomerType);
    if (rawCustomerAttr) record.rawCustomerAttrs.add(rawCustomerAttr);
  }

  const conflicts = [];
  const plans = [];

  for (const record of byName.values()) {
    const roleValues = [...record.rawCustomerTypes];
    const scaleValues = [...record.rawCustomerAttrs];

    if (roleValues.length > 1 || scaleValues.length > 1) {
      conflicts.push({
        name: record.name,
        rowCount: record.rowCount,
        rawCustomerTypes: roleValues,
        rawCustomerAttrs: scaleValues,
      });
      continue;
    }

    const customerRole = roleValues[0] || null;
    const customerScale = scaleValues[0] || null;

    if (!customerRole && !customerScale) {
      continue;
    }

    plans.push({
      name: record.name,
      customerRole,
      customerScale,
      rawCustomerType: customerRole,
      rawCustomerAttr: customerScale,
      rowCount: record.rowCount,
    });
  }

  return {
    plans,
    conflicts,
    uniqueCustomerCount: byName.size,
  };
}

async function main() {
  const { dataRows, nameIdx, customerTypeIdx, customerAttrIdx } = loadSheetRows();
  const { plans, conflicts, uniqueCustomerCount } = buildPlans(
    dataRows,
    nameIdx,
    customerTypeIdx,
    customerAttrIdx,
  );

  await db.connect();

  try {
    const existing = await db.query(
      `SELECT id, name, customer_role, customer_scale
         FROM external_object
        WHERE type = 'CUSTOMER'::object_type
          AND org_id = $1`,
      [ORG_ID],
    );

    const existingByName = new Map();
    for (const row of existing.rows) {
      const key = normalize(row.name);
      if (!key) continue;
      if (!existingByName.has(key)) existingByName.set(key, []);
      existingByName.get(key).push(row);
    }

    const matchedPlans = [];
    const missingInDb = [];

    for (const plan of plans) {
      const matches = existingByName.get(plan.name) || [];
      if (!matches.length) {
        missingInDb.push(plan);
        continue;
      }
      matchedPlans.push({ ...plan, matches });
    }

    console.log('=== 客户角色/规模原值回填预检查 ===');
    console.log(`Excel 数据行数: ${dataRows.filter(r => normalize(r[nameIdx])).length}`);
    console.log(`Excel 客户去重数: ${uniqueCustomerCount}`);
    console.log(`可生成回填计划数: ${plans.length}`);
    console.log(`命中数据库客户数: ${matchedPlans.length}`);
    console.log(`数据库未命中客户数: ${missingInDb.length}`);
    console.log(`冲突客户数: ${conflicts.length}`);
    console.log(`执行模式: ${APPLY ? 'APPLY（将写入数据库）' : 'DRY-RUN（仅预览，不写库）'}`);

    if (conflicts.length) {
      console.log('\n冲突客户（同名客户对应多个原始角色或规模，已跳过）：');
      conflicts.slice(0, 20).forEach((item) => {
        console.log(`  - ${item.name}`);
        console.log(`    原始客户类型: ${item.rawCustomerTypes.join(', ') || '-'}`);
        console.log(`    原始客户属性: ${item.rawCustomerAttrs.join(', ') || '-'}`);
      });
      if (conflicts.length > 20) {
        console.log(`  ... 其余 ${conflicts.length - 20} 条未展示`);
      }
    }

    if (missingInDb.length) {
      console.log('\n数据库中未找到的客户（按名称+组织匹配，已跳过）：');
      missingInDb.slice(0, 20).forEach((item) => {
        console.log(`  - ${item.name} | 角色=${item.customerRole || '-'} | 规模=${item.customerScale || '-'}`);
      });
      if (missingInDb.length > 20) {
        console.log(`  ... 其余 ${missingInDb.length - 20} 条未展示`);
      }
    }

    console.log('\n回填预览（前 20 条）：');
    matchedPlans.slice(0, 20).forEach((item) => {
      const beforeRoleSet = [...new Set(item.matches.map((m) => normalize(m.customer_role) || '-'))].join(', ');
      const beforeScaleSet = [...new Set(item.matches.map((m) => normalize(m.customer_scale) || '-'))].join(', ');
      console.log(
        `  - ${item.name}\n` +
        `    原始: 客户类型=${item.rawCustomerType || '-'} / 客户属性=${item.rawCustomerAttr || '-'}\n` +
        `    更新: customer_role ${beforeRoleSet} -> ${item.customerRole || '(清空)'} ; customer_scale ${beforeScaleSet} -> ${item.customerScale || '(清空)'}`,
      );
    });

    if (!APPLY) {
      console.log('\nDRY-RUN 完成。若确认无误，执行：');
      console.log('node scripts/backfill-customer-role-scale.js --apply');
      return;
    }

    await db.query('BEGIN');
    let updatedNameCount = 0;
    let updatedRowCount = 0;

    for (const item of matchedPlans) {
      const result = await db.query(
        `UPDATE external_object
            SET customer_role = $3,
                customer_scale = $4,
                updated_at = NOW()
          WHERE type = 'CUSTOMER'::object_type
            AND org_id = $1
            AND name = $2`,
        [ORG_ID, item.name, item.customerRole, item.customerScale],
      );
      updatedNameCount += 1;
      updatedRowCount += result.rowCount || 0;
    }

    await db.query('COMMIT');

    console.log('\n✅ 原值回填完成');
    console.log(`已更新客户名称数: ${updatedNameCount}`);
    console.log(`已更新数据库行数: ${updatedRowCount}`);
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {}
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('❌ 回填失败');
  console.error(error);
  process.exit(1);
});
