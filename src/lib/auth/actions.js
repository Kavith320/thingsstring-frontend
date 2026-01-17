// src/lib/auth/actions.js

import { clearAuth } from "./storage";

export function logout() {
  clearAuth();
  window.location.href = "/login";
}
