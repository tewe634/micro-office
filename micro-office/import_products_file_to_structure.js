#!/usr/bin/env node
// 将整份 Excel 首个工作表的数据导入到指定产品线/分类结构
// 用法:
// node import_products_file_to_structure.js <xlsx路径> <产品线> <一级分类> [二级分类] [系列展示口径]
// 例子:
// node import_products_file_to_structure.js "/mnt/d/BaiduNetdiskDownload/自主产品.xlsx" "INVEX" "自主"

const XLSX = require('xlsx');
const { Client } = require('pg');
const path = require('path');

function usage() {
  console.error('用法: node import_products_file_to_structure.js <xlsx路径> <产品线> <一级分类> [二级分类] [系列展示口径]');
  process.exit(1);
}

function normalizeArg(v, { required = false } = {}) {
  const text = String(v ?? '').trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') {
    if (required) usage();
    return null;
  }
  return text;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : null;
}

const xlsxPath = normalizeArg(process.argv[2], { required: true });
const productLine = normalizeArg(process.argv[3], { required: true });
const structureLevel1 = normalizeArg(process.argv[4], { required: true });
const structureLevel2 = normalizeArg(process.argv[5]);
const seriesDisplayName = normalizeArg(process.argv[6]);

const db = new Client({
  host: 'localhost',
  port: 5432,
  database: 'micro_office',
  user: 'postgres',
  password: 'postgres',
});

async function main() {
  const resolvedPath = path.resolve(xlsxPath);
  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  await db.connect();
  let importedCount = 0;

  for (const row of rows) {
    const code = String(row['物料号'] || '').trim();
    const name = String(row['物料名称'] || '').trim();
    if (!code || !name) continue;

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
         series_display_name = COALESCE(EXCLUDED.series_display_name, product.series_display_name),
         updated_at = NOW()`,
      [
        name,
        code,
        String(row['规格尺寸'] || '').trim() || null,
        parsePrice(row['面价']),
        productLine,
        String(row['物料类别'] || '').trim() || null,
        String(row['一级类别名称'] || '').trim() || null,
        String(row['二级类别名称'] || '').trim() || null,
        String(row['三级类别名称'] || '').trim() || null,
        structureLevel1,
        structureLevel2,
        seriesDisplayName,
      ]
    );
    importedCount += 1;
  }

  const summary = await db.query(
    `SELECT product_line, structure_level1, structure_level2, COUNT(*) AS total
       FROM product
      WHERE product_line = $1
        AND structure_level1 = $2
        AND COALESCE(structure_level2, '') = COALESCE($3, '')
      GROUP BY product_line, structure_level1, structure_level2`,
    [productLine, structureLevel1, structureLevel2]
  );

  console.log(`✓ 已导入/更新 ${importedCount} 条产品`);
  console.log(`  文件: ${resolvedPath}`);
  console.log(`  工作表: ${sheetName}`);
  console.log(`  归类: ${productLine} > ${structureLevel1}${structureLevel2 ? ` > ${structureLevel2}` : ''}`);
  if (summary.rows[0]) {
    console.log(`  当前目录下总数: ${summary.rows[0].total}`);
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
