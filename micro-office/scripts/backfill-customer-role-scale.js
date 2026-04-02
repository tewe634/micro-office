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

// 原始 Excel 值 -> 系统允许值
// ObjectController 当前仅允许：最终用户、总包商、制造商、分销商
const CUSTOMER_ROLE_MAP = {
  '原始设备制造商': '制造商',
  '工程总包商': '总包商',
  '最终用户': '最终用户',
  '盘柜厂': '制造商',
  '系统集成商': '总包商',
  '经销商、贸易商': '分销商',
};

// Excel 中“客户属性”字段映射到系统 customerScale
// 系统允许：大客户、中型客户、小客户
const CUSTOMER_SCALE_MAP = {
  '大客户-M': '大客户',
  '普通客户-N': '中型客户',
  'OEM客户-X': '中型客户',
  '项目客户-P': '中型客户',
  '非注册': '小客户',
};

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
    header,
    dataRows: rows.slice(1),
    nameIdx: indexOf('单位名称'),
    customerTypeIdx: indexOf('客户类型'),
    customerAttrIdx: indexOf('客户属性'),
  };
}

function buildPlans(dataRows, nameIdx, customerTypeIdx, customerAttrIdx) {
  const byName = new Map();
  const unknownRoleValues = new Map();
  const unknownScaleValues = new Map();

  for (const row of dataRows) {
    const name = normalize(row[nameIdx]);
    if (!name) continue;

    const rawCustomerType = normalize(row[customerTypeIdx]);
    const rawCustomerAttr = normalize(row[customerAttrIdx]);

    const mappedRole = rawCustomerType ? CUSTOMER_ROLE_MAP[rawCustomerType] : undefined;
    const mappedScale = rawCustomerAttr ? CUSTOMER_SCALE_MAP[rawCustomerAttr] : undefined;

    if (rawCustomerType && !mappedRole) {
      unknownRoleValues.set(rawCustomerType, (unknownRoleValues.get(rawCustomerType) || 0) + 1);
    }
    if (rawCustomerAttr && !mappedScale) {
      unknownScaleValues.set(rawCustomerAttr, (unknownScaleValues.get(rawCustomerAttr) || 0) + 1);
    }

    let record = byName.get(name);
    if (!record) {
      record = {
        name,
        rawCustomerTypes: new Set(),
        rawCustomerAttrs: new Set(),
        mappedRoles: new Set(),
        mappedScales: new Set(),
        rowCount: 0,
      };
      byName.set(name, record);
    }

    record.rowCount += 1;
    if (rawCustomerType) record.rawCustomerTypes.add(rawCustomerType);
    if (rawCustomerAttr) record.rawCustomerAttrs.add(rawCustomerAttr);
    if (mappedRole) record.mappedRoles.add(mappedRole);
    if (mappedScale) record.mappedScales.add(mappedScale);
  }

  const conflicts = [];
  const plans = [];

  for (const record of byName.values()) {
    const roles = [...record.mappedRoles];
    const scales = [...record.mappedScales];

    if (roles.length > 1 || scales.length > 1) {
      conflicts.push({
        name: record.name,
        rowCount: record.rowCount,
        rawCustomerTypes: [...record.rawCustomerTypes],
        rawCustomerAttrs: [...record.rawCustomerAttrs],
        mappedRoles: roles,
        mappedScales: scales,
      });
      continue;
    }

    const customerRole = roles[0];
    const customerScale = scales[0];

    if (!customerRole && !customerScale) {
      continue;
    }

    plans.push({
      name: record.name,
      customerRole,
      customerScale,
      rawCustomerType: [...record.rawCustomerTypes].join(' / '),
      rawCustomerAttr: [...record.rawCustomerAttrs].join(' / '),
      rowCount: record.rowCount,
    });
  }

  return {
    plans,
    conflicts,
    unknownRoleValues,
    unknownScaleValues,
    uniqueCustomerCount: byName.size,
  };
}

function printMap(title, map) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  无');
    return;
  }
  for (const [key, count] of rows) {
    console.log(`  - ${key}: ${count}`);
  }
}

async function main() {
  const { dataRows, nameIdx, customerTypeIdx, customerAttrIdx } = loadSheetRows();
  const { plans, conflicts, unknownRoleValues, unknownScaleValues, uniqueCustomerCount } = buildPlans(
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

    console.log('=== 客户角色/规模回填预检查 ===');
    console.log(`Excel 数据行数: ${dataRows.filter(r => normalize(r[nameIdx])).length}`);
    console.log(`Excel 客户去重数: ${uniqueCustomerCount}`);
    console.log(`可生成回填计划数: ${plans.length}`);
    console.log(`命中数据库客户数: ${matchedPlans.length}`);
    console.log(`数据库未命中客户数: ${missingInDb.length}`);
    console.log(`冲突客户数: ${conflicts.length}`);
    console.log(`执行模式: ${APPLY ? 'APPLY（将写入数据库）' : 'DRY-RUN（仅预览，不写库）'}`);

    printMap('未识别的客户类型原始值', unknownRoleValues);
    printMap('未识别的客户属性原始值', unknownScaleValues);

    if (conflicts.length) {
      console.log('\n冲突客户（同名客户映射出多个角色或规模，已跳过）：');
      conflicts.slice(0, 20).forEach((item) => {
        console.log(`  - ${item.name}`);
        console.log(`    原始客户类型: ${item.rawCustomerTypes.join(', ') || '-'}`);
        console.log(`    原始客户属性: ${item.rawCustomerAttrs.join(', ') || '-'}`);
        console.log(`    映射角色: ${item.mappedRoles.join(', ') || '-'}`);
        console.log(`    映射规模: ${item.mappedScales.join(', ') || '-'}`);
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
        `    更新: customer_role ${beforeRoleSet} -> ${item.customerRole || '(保持原值)'} ; customer_scale ${beforeScaleSet} -> ${item.customerScale || '(保持原值)'}`,
      );
    });

    if (!APPLY) {
      console.log('\nDRY-RUN 完成。若确认映射无误，执行：');
      console.log('node scripts/backfill-customer-role-scale.js --apply');
      return;
    }

    await db.query('BEGIN');
    let updatedNameCount = 0;
    let updatedRowCount = 0;

    for (const item of matchedPlans) {
      const result = await db.query(
        `UPDATE external_object
            SET customer_role = COALESCE($3, customer_role),
                customer_scale = COALESCE($4, customer_scale),
                updated_at = NOW()
          WHERE type = 'CUSTOMER'::object_type
            AND org_id = $1
            AND name = $2`,
        [ORG_ID, item.name, item.customerRole || null, item.customerScale || null],
      );
      updatedNameCount += 1;
      updatedRowCount += result.rowCount || 0;
    }

    await db.query('COMMIT');

    console.log('\n✅ 回填完成');
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
