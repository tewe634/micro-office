#!/usr/bin/env node

const XLSX = require('xlsx');
const { Client } = require('pg');
const path = require('path');

const db = new Client({
  host: process.env.PRODUCT_DB_HOST || 'localhost',
  port: Number(process.env.PRODUCT_DB_PORT || 5432),
  database: process.env.PRODUCT_DB_NAME || 'micro_office',
  user: process.env.PRODUCT_DB_USER || 'postgres',
  password: process.env.PRODUCT_DB_PASSWORD || 'postgres',
});

const ROOT = '/mnt/d/BaiduNetdiskDownload';

const LPDA_MAP = {
  'ACS55/150/310/355': { structureLevel2: 'ACS55/150/310/355' },
  'ACS510': { structureLevel2: 'ACS510' },
  'ACS550': { structureLevel2: 'ACS550' },
  'ACSM1/Servo (Controller+Driver+Motor)': { structureLevel2: 'Servo (Controller+Driver+Motor)' },
  '伺服产品Servo (Controller+Driver+Motor)': { structureLevel2: 'Servo (Controller+Driver+Motor)' },
  'ACS880-01(R1-R9)': { structureLevel2: 'ACS880-01/04(R1-R11)' },
  'ACS880-04(R10-R11)': { structureLevel2: 'ACS880-01/04(R1-R11)' },
  'ACS580-01(R0-R8)': { structureLevel2: 'ACS580-01/04 (R0-R11)' },
  'ACS580-01/04（R9-R11)': { structureLevel2: 'ACS580-01/04 (R0-R11)' },
  'ACH550/ACH580/ACQ580': { structureLevel2: 'ACH550/ACH580/ACQ580' },
  'ACS800-11/31': { structureLevel2: 'ACS800-11/31' },
  'External Options/LPDA Others': { structureLevel2: 'External Options/DP Others' },
  'AC500/AC500-eco/HMI': { structureLevel2: 'AC500/AC500-eco/HMI' },
  'ACS580-07': { structureLevel2: 'ACS580-07' },
  'ACH580-07': { structureLevel2: 'ACS580-07' },
  'ACS550-07': { structureLevel2: 'ACS580-07' },
  'ACS880-11/31/14/34': { structureLevel2: 'ACS880-11/31/14/34' },
  'ACH531': { structureLevel2: 'ACH531' },
  'ACQ531': { structureLevel2: 'ACQ531' },
  'ACS380': { structureLevel2: 'ACS380' },
  'ACS260': { structureLevel2: 'ACS280' },
  'ACS180': { structureLevel2: 'ACS180' },
  'ACP510': { structureLevel2: 'ACP510' },
  'ACM510': { structureLevel2: 'ACM510' },
  'ACS530': { structureLevel2: 'ACS530' },
  'ABB软启动器': { structureLevel2: 'External Options/DP Others' },
};

const HPD_MAP = {
  'HPD Others(Options and Packages)': { structureLevel2: 'HPD Others(Options and Packages)' },
  'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES8': { structureLevel2: 'ACS800/880-14/04(n*R8i)/ACS880-04XT/HES880' },
  'ACS800/880-07/ACS880-07XT/OEM Cabinet': { structureLevel2: 'ACS800/880-07/ACS880-07C/ACS880-07XT' },
  'ACS800/860/880 MD(Module&Cabinet)': { structureLevel2: 'ACS800/860/880 MD(Module&Cabinet)' },
  'ACS800/ACS880-17/37/SD-LC': { structureLevel2: 'ACS800/ACS880-17/37/SD-LC' },
  'DCS550': { structureLevel2: 'DC Drive products' },
  'DCS800(Module&Cabinet)': { structureLevel2: 'DC Drive products' },
  'DCS880': { structureLevel2: 'DC Drive products' },
  'ACS580MV': { structureLevel2: 'ACS580MV' },
  'ACS1000/ACS2000/5000A': { structureLevel2: 'ACS1000/ACS2000/5000A' },
};

const SERVICE_MAP = {
  '传动服务其他产品(培训、调试、维修等)': { structureLevel2: '服务业务' },
  'LV Spare Parts & service': { structureLevel2: '服务产品' },
  'MV Spare Parts & service（中压）': { structureLevel2: '服务产品' },
  'Motion OneCare无忧服务': { structureLevel2: '服务产品' },
  '预防性维护 Preventive Maintenance': { structureLevel2: '服务产品' },
  '交换机 Exchange units': { structureLevel2: '服务产品' },
  'Digital数字化': { structureLevel2: '服务产品' },
  'Modernization现代化': { structureLevel2: '服务产品' },
};

const TASKS = [
  {
    kind: 'whole',
    file: path.join(ROOT, 'ABB低压产品.xlsx'),
    productLine: 'ABB',
    structureLevel1: '低压',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, 'ABB高压电机.xlsx'),
    productLine: 'ABB',
    structureLevel1: '电机',
    structureLevel2: '高压电机',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, 'ABB低压电机.xlsx'),
    productLine: 'ABB',
    structureLevel1: '电机',
    structureLevel2: '低压电机',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, 'ABB变频器成套.xlsx'),
    productLine: 'ABB',
    structureLevel1: '成套',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, 'ABB电机服务.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'SE',
    structureLevel2: '电机服务',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, '自主产品.xlsx'),
    productLine: 'INVEX',
    structureLevel1: '自主',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, '贴牌产品.xlsx'),
    productLine: 'INVEX',
    structureLevel1: '贴牌',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, '其它产品成套.xlsx'),
    productLine: 'INVEX',
    structureLevel1: '成套',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, '其它外购产品.xlsx'),
    productLine: 'INVEX',
    structureLevel1: '外购',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, 'PLC产品.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'DP',
    structureLevel2: 'AC500/AC500-eco/HMI',
  },
  {
    kind: 'whole',
    file: path.join(ROOT, '伺服产品.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'DP',
    structureLevel2: 'Servo (Controller+Driver+Motor)',
  },
  {
    kind: 'map',
    file: path.join(ROOT, '服务产品 Service.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'SE',
    categoryMap: SERVICE_MAP,
  },
  {
    kind: 'map',
    file: path.join(ROOT, '低功率传动与自动化产品 LPDA.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'DP',
    categoryMap: LPDA_MAP,
  },
  {
    kind: 'map',
    file: path.join(ROOT, '高功率传动产品 HPD.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'HP',
    categoryMap: HPD_MAP,
  },
  {
    kind: 'map',
    file: path.join(ROOT, '中压传动产品 MVD.xlsx'),
    productLine: 'ABB',
    structureLevel1: 'HP',
    categoryMap: {
      '通用型(ACS5000A/2000DFE/1000)': { structureLevel2: 'ACS1000/ACS2000/5000A' },
    },
  },
];

const UPSERT_SQL = `INSERT INTO product (
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
  series_display_name = COALESCE(EXCLUDED.series_display_name, product.series_display_name),
  updated_at = NOW()`;

function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : null;
}

function text(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function readRows(file) {
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  return { sheetName, rows };
}

async function upsertRow(row, classification) {
  const categoryLevel3 = text(row['三级类别名称']);
  const structureLevel2 = classification.structureLevel2 ?? null;
  const seriesDisplayName = classification.seriesDisplayName ?? structureLevel2 ?? null;
  await db.query(UPSERT_SQL, [
    text(row['物料名称']),
    text(row['物料号']),
    text(row['规格尺寸']),
    parsePrice(row['面价']),
    classification.productLine,
    text(row['物料类别']),
    text(row['一级类别名称']),
    text(row['二级类别名称']),
    categoryLevel3,
    classification.structureLevel1,
    structureLevel2,
    seriesDisplayName,
  ]);
}

async function importWhole(task) {
  const { sheetName, rows } = readRows(task.file);
  let imported = 0;
  for (const row of rows) {
    const code = text(row['物料号']);
    const name = text(row['物料名称']);
    if (!code || !name) continue;
    await upsertRow(row, task);
    imported += 1;
  }
  return { file: task.file, sheetName, imported, unmatched: [] };
}

async function importMapped(task) {
  const { sheetName, rows } = readRows(task.file);
  let imported = 0;
  const unmatchedCounts = new Map();
  for (const row of rows) {
    const code = text(row['物料号']);
    const name = text(row['物料名称']);
    if (!code || !name) continue;
    const categoryLevel3 = text(row['三级类别名称']);
    const mapped = (categoryLevel3 && task.categoryMap[categoryLevel3]) || {};
    if (!mapped.structureLevel2 && categoryLevel3 && !task.categoryMap[categoryLevel3]) {
      unmatchedCounts.set(categoryLevel3, (unmatchedCounts.get(categoryLevel3) || 0) + 1);
    }
    await upsertRow(row, {
      productLine: task.productLine,
      structureLevel1: task.structureLevel1,
      structureLevel2: mapped.structureLevel2 ?? null,
      seriesDisplayName: mapped.seriesDisplayName ?? mapped.structureLevel2 ?? null,
    });
    imported += 1;
  }
  return {
    file: task.file,
    sheetName,
    imported,
    unmatched: [...unmatchedCounts.entries()].sort((a, b) => b[1] - a[1]),
  };
}

async function main() {
  await db.connect();
  const summaries = [];
  for (const task of TASKS) {
    const summary = task.kind === 'whole'
      ? await importWhole(task)
      : await importMapped(task);
    summaries.push(summary);
    console.log(`✓ ${path.basename(summary.file)} -> ${summary.imported}`);
    if (summary.unmatched.length) {
      console.log(`  未精确映射的三级分类: ${summary.unmatched.map(([name, count]) => `${name}(${count})`).join(', ')}`);
    }
  }

  const totals = await db.query(`
    SELECT product_line,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE structure_level1 IS NOT NULL) AS classified_l1,
           COUNT(*) FILTER (WHERE structure_level2 IS NOT NULL) AS classified_l2,
           COUNT(*) FILTER (WHERE series_display_name IS NOT NULL) AS classified_series
      FROM product
     GROUP BY product_line
     ORDER BY product_line
  `);

  console.log('\n=== 分类结果汇总 ===');
  for (const row of totals.rows) {
    console.log(`${row.product_line}: total=${row.total}, l1=${row.classified_l1}, l2=${row.classified_l2}, series=${row.classified_series}`);
  }

  const missing = await db.query(`
    SELECT product_line, COUNT(*) AS total
      FROM product
     WHERE structure_level1 IS NULL
     GROUP BY product_line
     ORDER BY product_line
  `);
  if (missing.rows.length) {
    console.log('\n=== 仍未归类数量 ===');
    for (const row of missing.rows) {
      console.log(`${row.product_line}: ${row.total}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
