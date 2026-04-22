#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

const DEFAULT_IMPORT_DIR = '/mnt/d/BaiduNetdiskDownload';
const apply = process.argv.includes('--apply');
const importDirArg = process.argv.find(arg => arg.startsWith('--dir='));
const importDir = path.resolve(importDirArg ? importDirArg.slice('--dir='.length) : (process.env.PRODUCT_IMPORT_DIR || DEFAULT_IMPORT_DIR));

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeCode(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+\.0+$/.test(text)) return text.replace(/\.0+$/, '');
  return text;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).replace(/,/g, '').trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function buildStructure(rule, row) {
  const c3 = normalizeText(row['三级类别名称']) || '';

  switch (rule.kind) {
    case 'fixed':
      return {
        productLine: rule.productLine,
        structureLevel1: rule.structureLevel1,
        structureLevel2: rule.structureLevel2 || null,
        seriesDisplayName: rule.seriesDisplayName || null,
      };
    case 'lpda': {
      const map = {
        'ACS55/150/310/355': 'ACS55/150/310/355',
        'ACS180': 'ACS180',
        'ACS380': 'ACS380',
        'ACS260': 'ACS280',
        'ACS510': 'ACS510',
        'ACP510': 'ACP510',
        'ACM510': 'ACM510',
        'ACS530': 'ACS530',
        'ACH531': 'ACH531',
        'ACQ531': 'ACQ531',
        'ACS550': 'ACS550',
        'ACH550/ACH580/ACQ580': 'ACH550/ACH580/ACQ580',
        'ACS580-01(R0-R8)': 'ACS580-01/04 (R0-R11)',
        'ACS580-01/04（R9-R11)': 'ACS580-01/04 (R0-R11)',
        'ACS580-07': 'ACS580-07',
        'ACS800-11/31': 'ACS800-11/31',
        'ACS880-01(R1-R9)': 'ACS880-01/04(R1-R11)',
        'ACS880-04(R10-R11)': 'ACS880-01/04(R1-R11)',
        'ACS880-11/31/14/34': 'ACS880-11/31/14/34',
        '伺服产品Servo (Controller+Driver+Motor)': 'Servo (Controller+Driver+Motor)',
        'ACSM1/Servo (Controller+Driver+Motor)': 'Servo (Controller+Driver+Motor)',
        'AC500/AC500-eco/HMI': 'AC500/AC500-eco/HMI',
        'External Options/LPDA Others': 'External Options/DP Others',
      };
      return {
        productLine: 'ABB',
        structureLevel1: 'DP',
        structureLevel2: map[c3] || 'External Options/DP Others',
        seriesDisplayName: null,
      };
    }
    case 'hpd': {
      const map = {
        'ACS580MV': 'ACS580MV',
        'ACS800/860/880 MD(Module&Cabinet)': 'ACS800/860/880 MD(Module&Cabinet)',
        'ACS800/880-07/ACS880-07XT/OEM Cabinet': 'ACS800/880-07/ACS880-07C/ACS880-07XT',
        'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES8': 'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES880',
        'ACS800/ACS880-17/37/SD-LC': 'ACS800/ACS880-17/37/SD-LC',
        'ACS1000/ACS2000/5000A': 'ACS1000/ACS2000/5000A',
        'HPD Others(Options and Packages)': 'HPD Others(Options and Packages)',
        'DCS800(Module&Cabinet)': 'DC Drive products',
        'DCS550': 'DC Drive products',
        'DCS880': 'DC Drive products',
      };
      return {
        productLine: 'ABB',
        structureLevel1: 'HP',
        structureLevel2: map[c3] || 'HPD Others(Options and Packages)',
        seriesDisplayName: null,
      };
    }
    case 'service': {
      const lower = c3.toLowerCase();
      const looksLikeProduct = lower.includes('spare parts') || lower.includes('exchange units');
      return {
        productLine: 'ABB',
        structureLevel1: 'SE',
        structureLevel2: looksLikeProduct ? '服务产品' : '服务业务',
        seriesDisplayName: null,
      };
    }
    case 'invexAwareService': {
      const isInvex = c3.includes('英飞克');
      return {
        productLine: isInvex ? 'INVEX' : 'ABB',
        structureLevel1: isInvex ? '服务' : 'SE',
        structureLevel2: isInvex ? null : '服务业务',
        seriesDisplayName: null,
      };
    }
    default:
      throw new Error(`Unknown rule kind: ${rule.kind}`);
  }
}

const rules = [
  { file: '自主产品.xlsx', kind: 'fixed', productLine: 'INVEX', structureLevel1: '自主' },
  { file: '贴牌产品.xlsx', kind: 'fixed', productLine: 'INVEX', structureLevel1: '贴牌' },
  { file: '英飞克原材料.xlsx', kind: 'fixed', productLine: 'INVEX', structureLevel1: '外购' },
  { file: '英飞克变频器成套.xlsx', kind: 'fixed', productLine: 'INVEX', structureLevel1: '成套' },
  { file: 'ABB低压产品.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '低压' },
  { file: '其它外购产品.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '低压' },
  { file: '低压开关.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '低压' },
  { file: 'ABB变频器成套.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '成套' },
  { file: '其它产品成套.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '成套' },
  { file: '成套原材料.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '成套' },
  { file: '其他.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '成套' },
  { file: 'ABB高压电机.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '电机', structureLevel2: '高压电机' },
  { file: 'ABB低压电机.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '电机', structureLevel2: '低压电机' },
  { file: '小电机.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: '电机', structureLevel2: '低压电机' },
  { file: 'ABB电机服务.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'SE', structureLevel2: '电机服务' },
  { file: '保内服务.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'SE', structureLevel2: '保内服务' },
  { file: '服务业务.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'SE', structureLevel2: '服务业务' },
  { file: '维护保养.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'SE', structureLevel2: '服务业务' },
  { file: '维修材料.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'SE', structureLevel2: '服务产品' },
  { file: '服务产品 Service.xlsx', kind: 'service' },
  { file: '维修业务.xlsx', kind: 'invexAwareService' },
  { file: '内部支持.xlsx', kind: 'invexAwareService' },
  { file: 'PLC产品.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'DP', structureLevel2: 'AC500/AC500-eco/HMI' },
  { file: 'AC500(老型号）.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'DP', structureLevel2: 'AC500/AC500-eco/HMI' },
  { file: '伺服产品.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'DP', structureLevel2: 'Servo (Controller+Driver+Motor)' },
  { file: 'DCS400.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'HP', structureLevel2: 'DC Drive products' },
  { file: 'DCS502.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'HP', structureLevel2: 'DC Drive products' },
  { file: '中压传动产品 MVD.xlsx', kind: 'fixed', productLine: 'ABB', structureLevel1: 'HP', structureLevel2: 'ACS1000/ACS2000/5000A' },
  { file: '高功率传动产品 HPD.xlsx', kind: 'hpd' },
  { file: '低功率传动与自动化产品 LPDA.xlsx', kind: 'lpda' },
];

const db = new Client({
  host: 'localhost',
  port: 5432,
  database: 'micro_office',
  user: 'postgres',
  password: 'postgres',
});

function makeKey(code, categoryLevel2) {
  return `${code}@@${categoryLevel2 || ''}`;
}

async function loadExistingProducts() {
  const result = await db.query(`
    SELECT id, code, product_line, category_level1, category_level2, category_level3,
           structure_level1, structure_level2, series_display_name
      FROM product
  `);
  const byCodeCategory2 = new Map();
  for (const row of result.rows) {
    const key = makeKey(row.code, row.category_level2);
    if (!byCodeCategory2.has(key)) byCodeCategory2.set(key, []);
    byCodeCategory2.get(key).push(row);
  }
  return byCodeCategory2;
}

function chooseExistingMatch(candidates, target) {
  if (!candidates || !candidates.length) return null;
  return candidates.find(item => item.product_line === target.productLine)
    || candidates.find(item => !item.structure_level1)
    || candidates[0];
}

async function upsertRow(target, existing) {
  const params = [
    target.name,
    target.code,
    target.spec,
    target.price,
    target.productLine,
    target.categoryCode,
    target.categoryLevel1,
    target.categoryLevel2,
    target.categoryLevel3,
    target.structureLevel1,
    target.structureLevel2,
    target.seriesDisplayName,
  ];

  if (existing) {
    await db.query(
      `UPDATE product
          SET name = $1,
              code = $2,
              spec = $3,
              price = $4,
              product_line = $5,
              category_code = $6,
              category_level1 = $7,
              category_level2 = $8,
              category_level3 = $9,
              structure_level1 = $10,
              structure_level2 = $11,
              series_display_name = $12,
              updated_at = NOW()
        WHERE id = $13`,
      [...params, existing.id]
    );
    return 'updated';
  }

  await db.query(
    `INSERT INTO product (
       name, code, spec, price, product_line,
       category_code, category_level1, category_level2, category_level3,
       structure_level1, structure_level2, series_display_name
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12
     )
     ON CONFLICT (code, product_line) DO UPDATE SET
       name = EXCLUDED.name,
       spec = EXCLUDED.spec,
       price = EXCLUDED.price,
       category_code = EXCLUDED.category_code,
       category_level1 = EXCLUDED.category_level1,
       category_level2 = EXCLUDED.category_level2,
       category_level3 = EXCLUDED.category_level3,
       structure_level1 = EXCLUDED.structure_level1,
       structure_level2 = EXCLUDED.structure_level2,
       series_display_name = EXCLUDED.series_display_name,
       updated_at = NOW()`,
    params
  );
  return 'inserted';
}

async function applyEdgeCasePatches() {
  const statements = [
    `UPDATE product
        SET product_line = 'ABB',
            structure_level1 = 'DP',
            structure_level2 = 'External Options/DP Others',
            series_display_name = NULL,
            updated_at = NOW()
      WHERE category_level2 = 'ABB已下线产品'`,
    `UPDATE product
        SET product_line = 'ABB',
            structure_level1 = 'SE',
            structure_level2 = '服务业务',
            series_display_name = NULL,
            updated_at = NOW()
      WHERE category_level2 = '贴息'`,
    `UPDATE product
        SET product_line = 'ABB',
            structure_level1 = '成套',
            structure_level2 = NULL,
            series_display_name = NULL,
            updated_at = NOW()
      WHERE category_level2 = '上海ABB工程有限公司'`,
    `UPDATE product
        SET product_line = 'ABB',
            structure_level1 = 'DP',
            structure_level2 = 'External Options/DP Others',
            series_display_name = NULL,
            updated_at = NOW()
      WHERE category_level2 = '东畅独立物料'`,
  ];
  for (const sql of statements) {
    await db.query(sql);
  }
}

async function main() {
  if (!fs.existsSync(importDir)) {
    throw new Error(`导入目录不存在: ${importDir}`);
  }

  console.log(`模式: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`导入目录: ${importDir}`);

  await db.connect();
  const existingMap = await loadExistingProducts();
  const summary = {
    files: 0,
    rowsSeen: 0,
    rowsSkipped: 0,
    rowsMapped: 0,
    updates: 0,
    inserts: 0,
  };
  const byTarget = new Map();

  if (apply) {
    await db.query('BEGIN');
  }

  for (const rule of rules) {
    const filePath = path.join(importDir, rule.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`! 跳过缺失文件: ${rule.file}`);
      continue;
    }

    const workbook = XLSX.readFile(filePath, { dense: true });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    summary.files += 1;

    let fileSeen = 0;
    let fileSkipped = 0;
    let fileMapped = 0;
    let fileUpdated = 0;
    let fileInserted = 0;

    for (const row of rows) {
      fileSeen += 1;
      summary.rowsSeen += 1;

      const code = normalizeCode(row['物料号']);
      const name = normalizeText(row['物料名称']);
      if (!code || !name) {
        fileSkipped += 1;
        summary.rowsSkipped += 1;
        continue;
      }

      const structure = buildStructure(rule, row);
      if (!structure || !structure.productLine || !structure.structureLevel1) {
        fileSkipped += 1;
        summary.rowsSkipped += 1;
        continue;
      }

      const target = {
        code,
        name,
        spec: normalizeText(row['规格尺寸']),
        price: parsePrice(row['面价']),
        categoryCode: normalizeText(row['物料类别']),
        categoryLevel1: normalizeText(row['一级类别名称']),
        categoryLevel2: normalizeText(row['二级类别名称']),
        categoryLevel3: normalizeText(row['三级类别名称']),
        productLine: structure.productLine,
        structureLevel1: structure.structureLevel1,
        structureLevel2: structure.structureLevel2 || null,
        seriesDisplayName: structure.seriesDisplayName || null,
      };

      fileMapped += 1;
      summary.rowsMapped += 1;

      const existingCandidates = existingMap.get(makeKey(target.code, target.categoryLevel2)) || [];
      const existing = chooseExistingMatch(existingCandidates, target);

      const targetKey = `${target.productLine} > ${target.structureLevel1}${target.structureLevel2 ? ` > ${target.structureLevel2}` : ''}`;
      byTarget.set(targetKey, (byTarget.get(targetKey) || 0) + 1);

      if (apply) {
        const action = await upsertRow(target, existing);
        if (action === 'updated') {
          fileUpdated += 1;
          summary.updates += 1;
        } else {
          fileInserted += 1;
          summary.inserts += 1;
        }
      } else {
        if (existing) {
          fileUpdated += 1;
          summary.updates += 1;
        } else {
          fileInserted += 1;
          summary.inserts += 1;
        }
      }
    }

    console.log(`\n${rule.file}`);
    console.log(`  读取: ${fileSeen}`);
    console.log(`  跳过: ${fileSkipped}`);
    console.log(`  映射: ${fileMapped}`);
    console.log(`  ${apply ? '更新' : '将更新'}: ${fileUpdated}`);
    console.log(`  ${apply ? '插入' : '将插入'}: ${fileInserted}`);
  }

  if (apply) {
    await applyEdgeCasePatches();
    await db.query('COMMIT');
  }

  console.log('\n=== 汇总 ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n=== 分类目标分布（前 30）===');
  for (const [key, count] of [...byTarget.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`${key}: ${count}`);
  }
}

main()
  .catch(async (error) => {
    if (apply) {
      try {
        await db.query('ROLLBACK');
      } catch (_) {}
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
