import api from "./axios";

// Forms
export const getForms = () => api.get("/forms/");
export const getForm = (id) => api.get(`/forms/${id}/`);
export const createForm = (data) => api.post("/forms/", data);
export const updateForm = (id, data) => api.put(`/forms/${id}/`, data);
export const deleteForm = (id) => api.delete(`/forms/${id}/`);

// Form Actions
export const publishForm = async (formId) => {
  const response = await api.post(`/forms/${formId}/publish/`);
  return response.data;
};

export const archiveForm = async (formId) => {
  const response = await api.post(`/forms/${formId}/archive/`);
  return response.data;
};

export const editForm = async (formId) => {
  const response = await api.post(`/forms/${formId}/edit/`);
  return response.data;
};

export const getPublicForm = async (shareToken) => {
  const response = await api.get(
    `/forms/share/${shareToken}/`
  );

  return response.data;
};

export const submitPublicForm = async (shareToken, data) => {
  const response = await api.post(
    `/forms/share/${shareToken}/submit/`,
    data
  );

  return response.data;
};

export const getFormResponses = async (formId, params = {}) => {
  const response = await api.get(`/forms/${formId}/responses/`, { params });
  return response.data;
};

export const startPublicForm = async (shareToken) => (await api.post(`/forms/share/${shareToken}/start/`)).data;

export const getFormAnalytics = async (formId) => (await api.get(`/forms/${formId}/analytics/`)).data;
export const duplicateForm = async (formId, data = {}) => (await api.post(`/forms/${formId}/duplicate/`, data)).data;
export const setRetentionPolicy = async (formId, data) => (await api.post(`/forms/${formId}/retention/`, data)).data;
export const setFormExpiration = async (formId, data) => (await api.post(`/forms/${formId}/expiration/`, data)).data;
export const bulkDeleteResponses = async (formId, submission_ids) => (await api.post(`/forms/${formId}/responses/bulk-delete/`, { submission_ids })).data;
export const exportResponses = (formId, format = "csv") =>
  api.get(`/forms/${formId}/export/`, {
    // `format` is reserved by Django REST Framework for renderer negotiation.
    // Using it makes DRF return a 404 before the export view is reached.
    params: { export_format: format },
    responseType: "blob",
  });

// Fields
export const getFields = (formId) =>
  api.get(`/forms/${formId}/fields/`);

export const createField = (formId, data) =>
  api.post(`/forms/${formId}/fields/`, data);

export const updateField = (fieldId, data) =>
  api.patch(`/fields/${fieldId}/`, data);

export const deleteField = (fieldId) =>
  api.delete(`/fields/${fieldId}/`);

export const reorderFields = (formId, data) =>
  api.patch(`/forms/${formId}/fields/reorder/`, data);

// Conditional Rules
export const getConditionalRules = async (formId) => {
  const response = await api.get(
    `/forms/${formId}/conditional_rules/`
  );

  return response.data;
};

export const createConditionalRule = async (
  formId,
  data
) => {
  const response = await api.post(
    `/forms/${formId}/conditional_rules/`,
    data
  );

  return response.data;
};

export const deleteConditionalRule = (ruleId) =>
  api.delete(`/conditional-rules/${ruleId}/`);

// AI / Automated Form Creation
export const autoGenerateForm = async (data) =>
  (await api.post("/forms/auto-generate/", data)).data;

// One-Time Submission Links
export const getOneTimeLinks = async (formId) =>
  (await api.get(`/forms/${formId}/one-time-links/`)).data;

export const createOneTimeLinks = async (formId, data) =>
  (await api.post(`/forms/${formId}/one-time-links/`, data)).data;

export const deleteOneTimeLink = async (formId, tokenId) =>
  (await api.delete(`/forms/${formId}/one-time-links/${tokenId}/`)).data;

// Public Single-Use Form Operations
export const getPublicSingleUseForm = async (singleToken) =>
  (await api.get(`/forms/single/${singleToken}/`)).data;

export const startPublicSingleUseForm = async (singleToken) =>
  (await api.post(`/forms/single/${singleToken}/start/`)).data;

export const submitPublicSingleUseForm = async (singleToken, data) =>
  (await api.post(`/forms/single/${singleToken}/submit/`, data)).data;

// Email OTP Verification
export const sendPublicFormOTP = async (token, email, isSingleUse = false) => {
  const endpoint = isSingleUse
    ? `/forms/single/${token}/send-otp/`
    : `/forms/share/${token}/send-otp/`;
  return (await api.post(endpoint, { email })).data;
};

export const verifyPublicFormOTP = async (token, email, otpCode, isSingleUse = false) => {
  const endpoint = isSingleUse
    ? `/forms/single/${token}/verify-otp/`
    : `/forms/share/${token}/verify-otp/`;
  return (await api.post(endpoint, { email, otp_code: otpCode })).data;
};

export const updateFormEmailSettings = async (formId, data) =>
  (await api.post(`/forms/${formId}/email_settings/`, data)).data;


