// src/lib/auth/storage.js
const TOKEN_KEY = "ts_token";
const USERID8_KEY = "ts_userId8";

export function setAuth({ token, userId8 }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERID8_KEY, userId8);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId8() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERID8_KEY);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERID8_KEY);
}

export function isAuthed() {
  return !!getToken();
}
