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

export const uiText = {
  appEmpty: '暂无数据',
  noClockRecords: '暂无打卡记录',
  noPendingItems: '暂无待处理事项',
  noRelatedRecords: '暂无关联记录',
  noMessageRecords: '暂无消息记录',
  noNodeRecords: '暂无节点记录',
  noExternalObjectLinks: '暂无关联外部对象',
  noAchievementRecords: '暂无记录，可点击右上角新增',
  deleteConfirm: '确定要删除当前记录吗？',
  removeReferenceConfirm: '确定要移除这条关联吗？',
  cancelWorkflowConfirm: '确定要取消当前工作流吗？',
  cancelNodeConfirm: '确定要取消当前节点吗？',
  finishWorkflowConfirm: '确定要完成当前节点，并将整个工作流标记为已完成吗？',
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

export function formatPaginationTotal(total: number) {
  return `共 ${total} 条记录`;
}
