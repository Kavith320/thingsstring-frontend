"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/lib/auth/storage";

const subscribe = () => () => {};
const hasToken = () => !!getToken();
const serverSnapshot = () => false; // localStorage doesn't exist on the server

/**
 * Client-side auth guard for the dashboard. The token lives in localStorage,
 * so this can only run in the browser. Renders nothing until a token is found,
 * so logged-out visitors are redirected instead of seeing failing API calls.
 * (Expired/revoked tokens are handled by apiRequest on a 401.)
 */
export default function ProtectedClient({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const authed = useSyncExternalStore(subscribe, hasToken, serverSnapshot);

  useEffect(() => {
    // Read storage directly: during hydration `authed` still holds the server
    // snapshot (false) for one render, which would bounce logged-in users.
    if (getToken()) return;
    const next = encodeURIComponent(pathname || "/dashboard");
    router.replace(`/login?next=${next}`);
  }, [authed, router, pathname]);

  return authed ? children : null;
}
