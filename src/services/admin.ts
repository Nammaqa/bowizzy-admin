import api, { setAuthToken as setApiAuthToken } from "./api";

export async function getInterviewers() {

  try {
    const token = localStorage.getItem("authToken");
    if (token) {
      setApiAuthToken(token);
      console.log("[getInterviewers] using token from localStorage (masked)", token.slice(0, 12) + "...");
    }
  } catch (e) {}

  const res = await api.get(`/admin/interviewers`);
  return res.data;
}

export async function getUsers() {
  const res = await api.get(`/admin/users`);
  return res.data;
}

export async function updateUser(id: number | string, data: Record<string, any>) {
  const res = await api.put(`/admin/users/${id}`, data);
  return res.data;
}

// Convenience helper to confirm an interviewer; ensure we send a boolean true
export async function confirmInterviewer(id: number | string) {
  // send boolean true (some backends accept string but boolean is canonical)
  const payload = { is_interviewer_verified: true };
  const res = await api.put(`/admin/users/${id}`, payload);
  return res.data;
}

export async function getResumes() {
  const res = await api.get(`/admin/resumes`);
  return res.data;
}

export async function getUserPlanStats() {
  const res = await api.get(`/admin/user-plan-stats`);
  return res.data;
}

export async function getInterviewSlotStats(params: { from: string; to: string; mode?: string }) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.mode) query.set("mode", params.mode);
  const res = await api.get(`/admin/interview-slot-stats?${query.toString()}`);
  return res.data;
}

// Helper to set the auth token for subsequent requests
export function setAuthToken(token?: string | null) {
  setApiAuthToken(token ?? null);
}

// Clear local auth state and (optionally) notify the backend
export async function logout() {
  try {
    // attempt server-side logout if supported; ignore errors
    await api.post(`/auth/logout`);
  } catch (e) {}
  setAuthToken(null);
  // eslint-disable-next-line no-console
  console.log("[auth] logged out");
}

export async function loginAdmin(credentials: { email: string; password: string }) {
  const res = await api.post(`/admin/login`, credentials);
  // if your backend returns a token in res.data.token, store it
  if (res.data && res.data.token) setAuthToken(res.data.token);
  return res.data;
}

export async function authLogin(credentials: { email: string; password: string }) {
  const payload = { ...credentials, type: "login" };
  console.log("[authLogin] login attempt ->", { email: credentials.email, type: payload.type });
  const res = await api.post(`/auth/admin-login`, payload);
  const token = res?.data?.token || res?.data?.accessToken || res?.data?.jwt || res?.data?.data?.token;
  if (token) setAuthToken(token);
  return res.data;
}

// Get all users with bank details (interviewers)
export async function getInterviewersWithBankDetails() {
  const res = await api.get(`/admin/all-users-with-bank-details`);
  return res.data;
}

// Mark an interviewer as verified
export async function markInterviewerVerified(userId: number | string) {
  const res = await api.put(`/admin/users/${userId}`, { is_verified: true });
  return res.data;
}

// Get accepted interviews
export async function getAcceptedInterviews() {
  const res = await api.get(`/admin/accepted-interviews`);
  return res.data;
}



// Pricing endpoints
export async function getPricing() {
  const res = await api.get(`/admin/pricing`);
  return res.data;
}

export async function createPricing(data: { bowizzy_plan_type: string; amount: number }) {
  const res = await api.post(`/admin/pricing`, data);
  return res.data;
}

export async function updatePricing(id: number | string, data: Record<string, any>) {
  const res = await api.put(`/admin/pricing/${id}`, data);
  return res.data;
}

export async function deletePricing(id: number | string) {
  const res = await api.delete(`/admin/pricing/${id}`);
  return res.data;
}
export default { getInterviewers, getUsers, updateUser, confirmInterviewer, getResumes, setAuthToken, loginAdmin, authLogin, logout, getInterviewersWithBankDetails, markInterviewerVerified, getAcceptedInterviews };