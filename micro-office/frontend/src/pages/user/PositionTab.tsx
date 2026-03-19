import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Pagination } from 'antd';
import { positionApi } from '../../api';
import { formatPaginationTotal, paginationLocale, uiText } from '../../constants/ui';

export default function PositionTab() {
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="page-toolbar-right">
          <Button type="primary" onClick={() => { setEdit(null); form.resetFields(); setModal(true); }}>新增</Button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, padding: '12px 12px 32px 12px', overflow: 'hidden' }}>
            <Table
              dataSource={data}
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              scroll={{ y: 'calc(100dvh - 455px)' }}
              columns={[
                { title: '序号', key: 'index', width: 70, render: (_: any, __: any, index: number) => (current - 1) * size + index + 1 },
                { title: '岗位名称', dataIndex: 'name', ellipsis: true },
                { title: '编码', dataIndex: 'code', width: 220, ellipsis: true },
                {
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
                },
              ]}
            />
          </div>

          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '12px 16px 16px',
              borderTop: '1px solid #f0f0f0',
              background: '#fff',
            }}
          >
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

      <Modal okText="确定" cancelText="取消" title={edit ? '编辑岗位' : '新增岗位'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={save} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
