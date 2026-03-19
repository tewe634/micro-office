import { Card, Tabs } from 'antd';
import UserTab from './UserTab';
import PositionTab from './PositionTab';

export default function UserAndPositionPage() {
  return (
    <Card
      title="人员管理"
      className="page-card page-fill"
      styles={{ body: { padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="page-card-body">
        <Tabs
          className="page-tabs"
          items={[
            {
              key: 'users',
              label: '人员',
              children: (
                <div className="page-fill">
                  <UserTab />
                </div>
              ),
            },
            {
              key: 'positions',
              label: '岗位',
              children: (
                <div className="page-fill">
                  <PositionTab />
                </div>
              ),
            },
          ]}
        />
      </div>
    </Card>
  );
}
