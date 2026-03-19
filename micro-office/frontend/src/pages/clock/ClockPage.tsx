import { useEffect, useState } from 'react';
import { Card, Button, List, Tag, Space, message } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { clockApi } from '../../api';
import { uiText } from '../../constants/ui';

export default function ClockPage() {
  const [records, setRecords] = useState<any[]>([]);

  const load = async () => { const r: any = await clockApi.today(); setRecords(r.data || []); };
  useEffect(() => { load(); }, []);

  const punch = async (type: string) => {
    await clockApi.punch(type);
    message.success(type === 'CLOCK_IN' ? '上班打卡成功' : '下班打卡成功');
    load();
  };

  return (
    <Card title="打卡" extra={
      <Space>
        <Button type="primary" icon={<ClockCircleOutlined />} onClick={() => punch('CLOCK_IN')}>上班打卡</Button>
        <Button icon={<ClockCircleOutlined />} onClick={() => punch('CLOCK_OUT')}>下班打卡</Button>
      </Space>
    }>
      <List dataSource={records} locale={{ emptyText: uiText.noClockRecords }} renderItem={(item: any) => (
        <List.Item>
          <Tag color={item.type === 'CLOCK_IN' ? 'green' : 'blue'}>{item.type === 'CLOCK_IN' ? '上班' : '下班'}</Tag>
          {item.clockTime}
        </List.Item>
      )} />
    </Card>
  );
}
