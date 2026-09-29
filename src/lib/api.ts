const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Upper bound on a single request. Without it a request that never settles
 * leaves the caller's spinner on forever.
 */
const REQUEST_TIMEOUT_MS = 30_000;

if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error('VITE_API_URL is not set. API calls will fail in production.');
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  keepalive?: boolean;
  signal?: AbortSignal;
}

function getToken(): string | null {
  return localStorage.getItem('prrms_token');
}

function setToken(token: string) {
  localStorage.setItem('prrms_token', token);
}

function clearToken() {
  localStorage.removeItem('prrms_token');
}

/**
 * Invoked when the API rejects our credentials so the app can drop the stale
 * session and return the user to the login screen. Set once by AppContext.
 * Without this, an expired token left the app shell rendered with every
 * request failing and no way back except a manual reload.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function handleAuthFailure() {
  clearToken();
  onUnauthorized?.();
}

async function request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {}, signal } = options;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      keepalive: options.keepalive,
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // A rejected fetch is a transport failure (offline, DNS, CORS, abort) and
    // must not be reported as an auth failure.
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      throw new Error(options.signal ? 'Request cancelled' : 'Request timed out — please try again');
    }
    throw new Error('Network error — check your connection and try again');
  }

  const text = await res.text();
  if (!res.ok) {
    let errorBody: any = { message: res.statusText };
    if (text) {
      try {
        errorBody = JSON.parse(text);
      } catch {
        errorBody = { message: text };
      }
    }
    if (res.status === 401) {
      handleAuthFailure();
    }
    throw new Error(errorBody.message || errorBody.error || `API error: ${res.status}`);
  }

  if (!text) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

async function uploadRequest<T = any>(endpoint: string, formData: FormData, options: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
    signal: options.signal,
  });
  if (!res.ok) {
    if (res.status === 401) {
      handleAuthFailure();
    }
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error || `API error: ${res.status}`);
  }

  // Guard the parse: an empty or non-JSON 2xx body previously rejected with a
  // raw SyntaxError that bypassed the message formatting every caller expects.
  try {
    return await res.json();
  } catch {
    return null as T;
  }
}

// ─── Auth ───────────────────────────────────────────────

export async function loginApi(email: string, password: string) {
  const data = await request<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setToken(data.token);
  return data;
}

export async function impersonateUser(userId: string) {
  const data = await request<{ token: string; user: any }>('/auth/impersonate', {
    method: 'POST',
    body: { userId },
  });
  setToken(data.token);
  return data;
}

export async function forgotPassword(email: string) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  return request('/auth/reset-password', { method: 'POST', body: { token, newPassword } });
}

export async function logoutApi() {
  return request('/auth/logout', { method: 'POST' });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function updateUserProfile(data: { firstName?: string; lastName?: string; title?: string; phone?: string; constituency?: string }) {
  return request('/auth/profile', { method: 'PUT', body: data });
}

export interface AccountActivity {
  id: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
}

// Recent activity recorded against the signed-in user. Used by Settings to show
// real account history (sign-ins, password and profile changes).
export async function getAccountActivity() {
  return request<AccountActivity[]>('/auth/activity');
}

// ─── Requests ───────────────────────────────────────────

export interface GetRequestsParams {
  status?: string;
  priority?: string;
  committeeId?: string;
  search?: string;
  archived?: boolean;
  page?: number;
  limit?: number;
}

export async function getRequests(params?: GetRequestsParams) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return request(`/requests/${qs ? `?${qs}` : ''}`);
}

export async function getRequest(id: string) {
  return request(`/requests/${id}`);
}

export async function getRequestActivity(id: string) {
  return request(`/requests/${id}/activity`);
}

export async function createRequest(data: {
  title: string;
  description: string;
  scope?: string;
  requestingOffice?: string;
  keyStakeholders?: string;
  dataSources?: string;
  language?: string;
  priority?: string;
  deadline: string;
  committeeId?: string | null;
  templateId?: string;
}) {
  return request('/requests/', { method: 'POST', body: data });
}

export async function updateRequest(id: string, data: Record<string, any>) {
  return request(`/requests/${id}`, { method: 'PUT', body: data });
}

export async function cancelRequest(id: string) {
  return request(`/requests/${id}/cancel`, { method: 'POST', body: {} });
}

export async function getCommittees() {
  return request('/requests/meta/committees');
}

// ─── Assignments ────────────────────────────────────────

export async function getPendingAssignments() {
  return request('/assignments/pending');
}

export async function createAssignment(data: {
  requestId: string;
  assignedToId?: string;
  assignedToIds?: string[];
  teamId?: string;
  action?: 'assign' | 'reassign' | 'add';
  deadline: string;
  notes?: string;
}) {
  return request('/assignments/', { method: 'POST', body: data });
}

export async function getOfficers() {
  return request('/assignments/officers');
}

// ─── Teams ──────────────────────────────────────────────

export async function getTeams(params?: { includeInactive?: boolean }) {
  return request(`/teams/${params?.includeInactive ? '?includeInactive=true' : ''}`);
}

export async function getTeam(teamId: string) {
  return request(`/teams/${teamId}`);
}

export async function createTeam(data: { name: string; description?: string; leadId?: string; memberIds?: string[] }) {
  return request('/teams/', { method: 'POST', body: data });
}

export async function updateTeam(teamId: string, data: { name?: string; description?: string; leadId?: string; isActive?: boolean }) {
  return request(`/teams/${teamId}`, { method: 'PUT', body: data });
}

export async function addTeamMembers(teamId: string, userIds: string[]) {
  return request(`/teams/${teamId}/members`, { method: 'POST', body: { userIds } });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

export async function deactivateTeam(teamId: string) {
  return request(`/teams/${teamId}`, { method: 'DELETE' });
}

// ─── Reports ────────────────────────────────────────────

export async function createReport(
  data: {
    requestId: string;
    title: string;
    content?: string;
    filePath?: string;
    fileType?: string;
    fileSize?: number;
    isDraft?: boolean;
    notes?: string;
  },
  options: { keepalive?: boolean } = {},
) {
  return request('/reports/', { method: 'POST', body: data, keepalive: options.keepalive });
}

export async function updateReport(
  reportId: string,
  data: { content?: string; isDraft?: boolean; notes?: string },
  options: { keepalive?: boolean } = {},
) {
  return request(`/reports/${reportId}`, { method: 'PUT', body: data, keepalive: options.keepalive });
}

export async function getReportVersions(reportId: string) {
  return request(`/reports/${reportId}/versions`);
}

export async function compareReportVersions(reportId: string, v1: number, v2: number) {
  return request(`/reports/${reportId}/versions/${v1}/compare/${v2}`);
}

// ─── Global Search ──────────────────────────────────────

export async function globalSearch(query: string, signal?: AbortSignal) {
  return request(`/requests/search/global?q=${encodeURIComponent(query)}`, { signal });
}

// ─── Assignment Accept/Decline ──────────────────────────

export async function getMyAssignments() {
  return request('/assignments/mine');
}

export async function acceptAssignment(assignmentId: string) {
  return request(`/assignments/${assignmentId}/accept`, { method: 'POST' });
}

export async function declineAssignment(assignmentId: string, reason?: string) {
  return request(`/assignments/${assignmentId}/decline`, {
    method: 'POST',
    body: { reason },
  });
}

// ─── Workload Balancing ─────────────────────────────────

export async function getWorkloadStats() {
  return request('/dashboard/workload');
}

// ─── Reviews ────────────────────────────────────────────

export async function getReviews(requestId: string) {
  return request(`/reviews/request/${requestId}`);
}

export async function createReview(data: {
  reportId?: string;
  requestId: string;
  section?: string;
  text: string;
  highlightedText?: string;
  startOffset?: number;
  endOffset?: number;
  parentId?: string;
}) {
  return request('/reviews/', { method: 'POST', body: data });
}

export async function requestRevision(data: { requestId: string; reportId?: string; commentText?: string }) {
  return request('/reviews/request-revision', {
    method: 'POST',
    body: { requestId: data.requestId, commentText: data.commentText },
  });
}

export async function approveReport(data: { reportId: string; requestId: string }) {
  return request('/reviews/approve', { method: 'POST', body: data });
}

export async function confirmSatisfaction(data: { requestId: string; note?: string }) {
  return request('/reviews/confirm', {
    method: 'POST',
    body: { requestId: data.requestId, note: data.note },
  });
}

export async function resolveReviewComment(commentId: string) {
  return request(`/reviews/${commentId}/resolve`, { method: 'PUT' });
}

// ─── Users ──────────────────────────────────────────────

export async function getUsers(params?: { role?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, v);
    });
  }
  const qs = query.toString();
  return request(`/users/${qs ? `?${qs}` : ''}`);
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  title?: string;
  phone?: string;
  departmentId?: string;
}) {
  return request('/users/', { method: 'POST', body: data });
}

export async function updateUser(id: string, data: Record<string, any>) {
  return request(`/users/${id}`, { method: 'PUT', body: data });
}

export async function resetPassword(id: string, newPassword: string) {
  return request(`/users/${id}/reset-password`, { method: 'POST', body: { newPassword } });
}

export async function deactivateUser(id: string) {
  return request(`/users/${id}/deactivate`, { method: 'POST', body: {} });
}

// ─── Notifications ──────────────────────────────────────

export async function getNotifications(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request(`/notifications/${qs ? `?${qs}` : ''}`);
}

export async function markNotificationRead(id: string) {
  return request(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'PUT' });
}

// ─── Notification Preferences ──────────────────────────

export async function getNotificationPrefs() {
  return request('/auth/notification-prefs');
}

export async function updateNotificationPrefs(prefs: {
  pushNotifications: boolean;
  emailSummaries: boolean;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  triggers: {
    newAssignments: boolean;
    statusChanges: boolean;
    draftMentions: boolean;
    deadlineReminders: boolean;
  };
}) {
  return request('/auth/notification-prefs', { method: 'PUT', body: prefs });
}

// ─── Dashboard ──────────────────────────────────────────

export async function getDashboard() {
  return request('/dashboard/');
}

export async function getAnalytics() {
  return request('/dashboard/analytics');
}

export async function getActivityLog(params?: { action?: string; entityType?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return request(`/dashboard/activity${qs ? `?${qs}` : ''}`);
}

// ─── Templates ─────────────────────────────────────────

export async function getTemplates() {
  return request('/templates/');
}

export async function getTemplate(id: string) {
  return request(`/templates/${id}`);
}

export async function createTemplate(data: {
  name: string;
  description?: string;
  category: string;
  sections: { heading: string; prompt: string }[];
}) {
  return request('/templates/', { method: 'POST', body: data });
}

export async function updateTemplate(
  id: string,
  data: {
    name: string;
    description?: string;
    category: string;
    sections: { heading: string; prompt: string }[];
  },
) {
  return request(`/templates/${id}`, { method: 'PUT', body: data });
}

export async function deleteTemplate(id: string) {
  return request(`/templates/${id}`, { method: 'DELETE' });
}

// ─── File Uploads ───────────────────────────────────────

export async function getAttachments(requestId: string) {
  return request(`/uploads/request/${requestId}`);
}

export async function uploadFile(requestId: string, file: File, onUploaded?: (attachment: any) => void) {
  const validationError = validateUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append('file', file);

  const data = await uploadRequest(`/uploads/${requestId}`, formData);
  if (onUploaded) onUploaded(data);
  return data;
}

export async function deleteAttachment(attachmentId: string) {
  return request(`/uploads/${attachmentId}`, { method: 'DELETE' });
}

export function getDownloadUrl(attachmentId: string) {
  return `${API_BASE}/uploads/${attachmentId}/download`;
}

export async function downloadFile(attachmentId: string, fileName: string): Promise<void> {
  const token = getToken();
  const url = `${API_BASE}/uploads/${attachmentId}/download`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorBody: any = { error: `Download failed (${res.status})` };
    if (errorText) {
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { error: errorText };
      }
    }
    throw new Error(errorBody.error || errorBody.message || `Download failed (${res.status})`);
  }

  const blob = await res.blob();

  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);

  link.click();

  // Revoke after the browser has started the download
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 500);
}

const ALLOWED_UPLOAD_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "txt", "csv", "rtf", "odt", "zip"];

// Client-side validation for uploads (mirrors the server rules: PDF/DOCX/XLSX/PPTX/TXT/CSV/RTF/ODT/ZIP up to 50MB)
export function validateUploadFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return "Only PDF, DOCX, XLSX, PPTX, TXT, CSV, RTF, ODT, and ZIP files are allowed";
  }
  if (file.size > 50 * 1024 * 1024) {
    return "File is too large. Maximum size is 50MB";
  }
  return null;
}

// ─── Utility ────────────────────────────────────────────

export { getToken, setToken, clearToken };

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE.replace('/api', '')}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
