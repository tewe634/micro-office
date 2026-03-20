import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Pagination } from 'antd';
import { positionApi } from '../../api';
import { formatPaginationTotal, paginationLocale, uiText } from '../../constants/ui';
import { useAuthStore } from '../../store/auth';

export default function PositionTab() {
  const role = useAuthStore(s => s.role);
  const canManagePersonnel = role === 'ADMIN' || role === 'HR';
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(20);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async (c = current, s = size) => {
    const r: any = await positionApi.page({ current: c, size: s });
    setData(r.data?.records || []);
    setTotal(r.data?.total || 0);
    setCurrent(c);
    setSize(s);
  };

  useEffect(() => {
    load(1, 20);
  }, []);

  const save = async (values: any) => {
    if (edit) await positionApi.update(edit.id, values);
    else await positionApi.create(values);
    message.success('保存成功');
    setModal(false);
    setEdit(null);
    form.resetFields();
    load(current, size);
  };

  return (
    <>
      <div className="fixed-table-page">
        <div className="page-toolbar-right fixed-table-page__section">
          {canManagePersonnel ? <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button> : null}
        </div>

        <div className="fixed-table-page__frame">
          <div className="fixed-table-page__table">
            <Table
              dataSource={data}
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: '100%' }}
              style={{ height: '100%' }}
              columns={[
                { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                { title: '岗位名称', dataIndex: 'name', ellipsis: true },
                { title: '编码', dataIndex: 'code', width: 220, ellipsis: true },
                ...(canManagePersonnel ? [{
                  title: '操作',
                  width: 140,
                  render: (_: any, r: any) => (
                    <Space>
                      <Button size="small" onClick={() => { setEdit(r); form.setFieldsValue(r); setModal(true); }}>编辑</Button>
                      <Popconfirm okText="确定" cancelText="取消" title={uiText.deleteConfirm} onConfirm={async () => { await positionApi.delete(r.id); message.success('已删除'); const nextCurrent = current > 1 && data.length === 1 ? current - 1 : current; load(nextCurrent, size); }}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  ),
                }] : []),
              ]}
            />
          </div>

          <div className="fixed-table-page__footer">
            <Pagination
              locale={paginationLocale}
              current={current}
              pageSize={size}
              total={total}
              showSizeChanger
              showTotal={(t) => formatPaginationTotal(t)}
              onChange={(page, pageSize) => load(page, pageSize)}
            />
          </div>
        </div>
      </div>

      {canManagePersonnel ? <Modal okText="确定" cancelText="取消" title={edit ? '编辑岗位' : '新增岗位'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal> : null}
    </>
  );
}
