const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
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

async function request<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

async function uploadRequest<T = any>(endpoint: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
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

export async function forgotPassword(email: string) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function updateUserProfile(data: { firstName?: string; lastName?: string; title?: string; phone?: string }) {
  return request('/auth/profile', { method: 'PUT', body: data });
}

// ─── Requests ───────────────────────────────────────────

export interface GetRequestsParams {
  status?: string;
  priority?: string;
  categoryId?: string;
  search?: string;
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

export async function createRequest(data: {
  title: string;
  subject?: string;
  description: string;
  scope?: string;
  keyStakeholders?: string;
  dataSources?: string;
  language?: string;
  priority?: string;
  deadline: string;
  categoryId?: string;
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

export async function getCommitteeStats() {
  return request('/requests/meta/committees/stats');
}

export async function getRequestsByCommittee(committeeId: string) {
  return request(`/requests/committee/${committeeId}`);
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
  deadline: string;
  notes?: string;
}) {
  return request('/assignments/', { method: 'POST', body: data });
}

export async function getOfficers() {
  return request('/assignments/officers');
}

// ─── Teams ──────────────────────────────────────────────

export async function getTeams() {
  return request('/teams/');
}

export async function getTeam(teamId: string) {
  return request(`/teams/${teamId}`);
}

export async function createTeam(data: { name: string; description?: string; leadId?: string; memberIds?: string[] }) {
  return request('/teams/', { method: 'POST', body: data });
}

export async function updateTeam(teamId: string, data: { name?: string; description?: string; leadId?: string }) {
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

export async function createReport(data: {
  requestId: string;
  title: string;
  content?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  isDraft?: boolean;
  notes?: string;
}) {
  return request('/reports/', { method: 'POST', body: data });
}

export async function getReportVersions(reportId: string) {
  return request(`/reports/${reportId}/versions`);
}

export async function compareReportVersions(reportId: string, v1: number, v2: number) {
  return request(`/reports/${reportId}/versions/${v1}/compare/${v2}`);
}

// ─── Cross-Committee Sharing ────────────────────────────

export async function shareWithCommittee(requestId: string, committeeId: string, notes?: string) {
  return request(`/requests/${requestId}/share`, {
    method: 'POST',
    body: { committeeId, notes },
  });
}

export async function getSharedCommittees(requestId: string) {
  return request(`/requests/${requestId}/shared`);
}

export async function getRequestsSharedWithCommittee(committeeId: string) {
  return request(`/requests/shared/committee/${committeeId}`);
}

// ─── Global Search ──────────────────────────────────────

export async function globalSearch(query: string) {
  return request(`/requests/search/global?q=${encodeURIComponent(query)}`);
}

// ─── Assignment Accept/Decline ──────────────────────────

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
  reportId: string;
  requestId: string;
  section?: string;
  text: string;
  highlightedText?: string;
  startOffset?: number;
  endOffset?: number;
}) {
  return request('/reviews/', { method: 'POST', body: data });
}

export async function requestRevision(data: { reportId: string; requestId: string }) {
  return request(`/reviews/${data.reportId}/request-revision`, {
    method: 'POST',
    body: { requestId: data.requestId },
  });
}

export async function approveReport(data: { reportId: string; requestId: string }) {
  return request('/reviews/approve', { method: 'POST', body: data });
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

// ─── File Uploads ───────────────────────────────────────

export async function getAttachments(requestId: string) {
  return request(`/uploads/request/${requestId}`);
}

export async function uploadFile(requestId: string, file: File, onUploaded?: (attachment: any) => void) {
  const formData = new FormData();
  formData.append('file', file);

  const data = await uploadRequest(`/uploads/${requestId}`, formData);
  if (onUploaded) onUploaded(data);
  return data;
}

export function getDownloadUrl(attachmentId: string) {
  const token = getToken();
  return `${API_BASE}/uploads/${attachmentId}/download${token ? `?token=${token}` : ''}`;
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
