import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("scamshield-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function registerUser(payload) {
  const { data } = await api.post("/auth/register", payload);
  return data;
}
export async function loginUser(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data;
}
export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data;
}
export async function getHistory() {
  const { data } = await api.get("/history");
  return data.history || [];
}
export async function deleteHistory(id) {
  await api.delete(`/history/${id}`);
}
export async function clearRemoteHistory() {
  await api.delete("/history");
}
export async function analyzeMessage(content, label = "Mensagem") {
  const normalizedLabel = String(label).toLowerCase();
  const type = normalizedLabel.includes("link") ? "link" : normalizedLabel.includes("imagem") ? "image" : "message";
  const response = await api.post("/analyze", { content, type });
  return response.data;
}
export async function checkApiHealth() {
  const response = await api.get("/health", { timeout: 5000 });
  return response.data;
}
export default api;
