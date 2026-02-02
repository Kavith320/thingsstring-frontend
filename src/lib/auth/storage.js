// src/lib/auth/storage.js
const TOKEN_KEY = "ts_token";
const USERID_KEY = "ts_userId";
const USERID8_KEY = "ts_userId8";

export function setAuth({ token, userId, userId8 }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  if (userId) localStorage.setItem(USERID_KEY, userId);
  if (userId8) localStorage.setItem(USERID8_KEY, userId8);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERID_KEY);
}

export function getUserId8() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERID8_KEY);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERID_KEY);
  localStorage.removeItem(USERID8_KEY);
}

export function isAuthed() {
  return !!getToken();
}
