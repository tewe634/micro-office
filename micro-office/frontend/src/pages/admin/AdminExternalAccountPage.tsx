import { Card } from 'antd';
import ExternalAccountBindingTab from './ExternalAccountBindingTab';

export default function AdminExternalAccountPage() {
  return (
    <Card title="账号绑定" bordered={false} bodyStyle={{ padding: 0 }}>
      <ExternalAccountBindingTab />
    </Card>
  );
}
