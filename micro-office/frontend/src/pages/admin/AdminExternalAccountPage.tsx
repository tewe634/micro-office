import { Card } from 'antd';
import ExternalAccountBindingTab from '../user/ExternalAccountBindingTab';

export default function AdminExternalAccountPage() {
  return (
    <Card title="外部账号" bordered={false} bodyStyle={{ padding: 0 }}>
      <ExternalAccountBindingTab />
    </Card>
  );
}
