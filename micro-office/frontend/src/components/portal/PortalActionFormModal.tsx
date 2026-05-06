import { Form, Input, InputNumber, Modal } from 'antd';
import { useEffect, useMemo } from 'react';
import type { PortalBlockTemplateActionFormFieldPayload } from '../../api';

type PortalActionFormModalProps = {
  open: boolean;
  formConfig: {
    title?: string | null;
    submitLabel?: string | null;
    fields?: PortalBlockTemplateActionFormFieldPayload[];
  } | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
};

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function activeFields(fields: PortalBlockTemplateActionFormFieldPayload[] | undefined) {
  return (fields || [])
    .filter((field) => (field.status || 'ACTIVE') === 'ACTIVE')
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
}

function initialValues(fields: PortalBlockTemplateActionFormFieldPayload[]) {
  return fields.reduce<Record<string, any>>((result, field) => {
    result[field.fieldKey] = field.defaultValue ?? undefined;
    return result;
  }, {});
}

export default function PortalActionFormModal({
  open,
  formConfig,
  loading = false,
  onCancel,
  onSubmit,
}: PortalActionFormModalProps) {
  const [form] = Form.useForm();
  const fields = useMemo(() => activeFields(formConfig?.fields), [formConfig?.fields]);
  const title = normalizeText(formConfig?.title) || '补充执行参数';
  const okText = normalizeText(formConfig?.submitLabel) || '确认';

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue(initialValues(fields));
  }, [fields, form, open]);

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        await onSubmit(values);
      }}
    >
      <Form form={form} layout="vertical">
        {fields.map((field) => {
          const inputType = String(field.inputType || 'TEXT').toUpperCase();
          const rules = field.required ? [{ required: true, message: `请输入${field.label}` }] : undefined;

          let node = (
            <Input
              placeholder={field.placeholder || undefined}
              maxLength={field.maxLength || undefined}
            />
          );

          if (inputType === 'TEXTAREA') {
            node = (
              <Input.TextArea
                placeholder={field.placeholder || undefined}
                maxLength={field.maxLength || undefined}
                autoSize={{ minRows: 3, maxRows: 6 }}
                showCount={!!field.maxLength}
              />
            );
          } else if (inputType === 'NUMBER') {
            node = (
              <InputNumber
                style={{ width: '100%' }}
                placeholder={field.placeholder || undefined}
              />
            );
          }

          return (
            <Form.Item
              key={field.id || field.fieldKey}
              name={field.fieldKey}
              label={field.label}
              rules={rules}
            >
              {node}
            </Form.Item>
          );
        })}
      </Form>
    </Modal>
  );
}
