import type { FormInstance } from 'antd';

export interface ApiFieldError {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  code?: number;
  message?: string;
  errorType?: string;
  field?: string;
  errors?: ApiFieldError[];
  data?: unknown;
}

export const getApiErrorData = (error: any): ApiErrorResponse | undefined => error?.response?.data;

export const getApiErrorMessage = (error: any, fallback = '请求失败') => {
  const responseMessage = getApiErrorData(error)?.message;
  return responseMessage || error?.message || fallback;
};

export const applyApiFormErrors = (form: FormInstance, error: any) => {
  const data = getApiErrorData(error);
  const normalizedErrors = (data?.errors || []).filter(item => item?.field && item?.message);
  const fallbackFieldError = !normalizedErrors.length && data?.field && data?.message
    ? [{ field: data.field, message: data.message }]
    : [];
  const fieldErrors = normalizedErrors.length ? normalizedErrors : fallbackFieldError;

  if (!fieldErrors.length) {
    return false;
  }

  form.setFields(fieldErrors.map(item => ({
    name: item.field!,
    errors: [item.message],
  })));
  return true;
};
