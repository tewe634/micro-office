export const roleLabelMap: Record<string, string> = {
  ADMIN: '管理员',
  SALES: '销售',
  BIZ: '商务',
  FINANCE: '财务',
  HR: '人事',
  TECH: '技术',
  WAREHOUSE: '仓储',
  IT: '信息技术',
  PRODUCTION: '生产',
  PURCHASE: '采购',
  STAFF: '普通员工',
};

export const objectTypeLabelMap: Record<string, string> = {
  CUSTOMER: '客户',
  SUPPLIER: '供应商',
  CARRIER: '承运商',
  BANK: '银行',
  THIRD_PARTY_PAY: '第三方支付',
  OTHER: '其他',
};

export const refTypeLabelMap: Record<string, string> = {
  THREAD: '工作流',
  OBJECT: '外部对象',
  PRODUCT: '产品',
};

export function formatRoleLabel(code?: string, name?: string) {
  if (code && roleLabelMap[code]) return roleLabelMap[code];
  if (name) {
    const upper = name.toUpperCase();
    if (roleLabelMap[upper]) return roleLabelMap[upper];
    if (name === 'IT') return '信息技术';
    return name;
  }
  return code || '-';
}

export function formatObjectType(type?: string) {
  return type ? objectTypeLabelMap[type] || type : '-';
}

export function formatRefType(type?: string) {
  return type ? refTypeLabelMap[type] || type : '-';
}

export function extractPagedRecords(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
}
