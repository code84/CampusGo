import axios from "axios";

export const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TOKEN_KEY = "campus_mobility_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" • ");
  return String(detail);
}

export async function fetchNotifications() {
  const { data } = await api.get("/notifications");
  return data;
}

export async function fetchUnreadCount() {
  const { data } = await api.get("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id) {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}

export function wsUrl(token) {
  const base = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}
