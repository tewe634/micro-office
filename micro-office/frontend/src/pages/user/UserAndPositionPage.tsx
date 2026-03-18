import { Card, Tabs } from 'antd';
import UserTab from './UserTab';
import PositionTab from './PositionTab';

export default function UserAndPositionPage() {
  return (
    <Card title="人员与岗位" styles={{ body: { padding: 0 } }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, padding: 24 }}>
        <Tabs items={[
          { key: 'users', label: '人员', children: <UserTab /> },
          { key: 'positions', label: '岗位', children: <PositionTab /> },
        ]} />
      </div>
    </Card>
  );
}
