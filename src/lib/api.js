// src/lib/api.js

import { getToken } from "@/lib/auth/storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest(
  endpoint,
  { method = "GET", body } = {}
) {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      data?.message || `API error (${res.status})`;
    throw new Error(msg);
  }

  return data;
}
