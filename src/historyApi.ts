// src/historyApi.ts
const API_BASE = "http://localhost:3000";

export interface ServerMessage {
  id: number;
  studentId: number;
  role: "user" | "model" | string;
  message: string;
  createdAt?: string;
}

export interface ServerHistoryResponse {
  success: boolean;
  history: ServerMessage[];
}

export const fetchChatHistory = async (
  studentId: number,
  token: string | null,
): Promise<ServerMessage[]> => {
  const res = await fetch(
    `${API_BASE}/api/chat/history?studentId=${studentId}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  const data: ServerHistoryResponse = await res.json();
  return Array.isArray(data.history) ? data.history : [];
};

export const clearServerHistory = async (
  studentId: number,
  token: string | null,
): Promise<void> => {
  const res = await fetch(
    `${API_BASE}/api/chat/history?studentId=${studentId}`,
    {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) throw new Error(`History clear failed: ${res.status}`);
};
