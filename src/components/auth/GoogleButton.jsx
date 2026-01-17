"use client";

import { useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { setAuth } from "@/lib/auth/storage";

export default function GoogleButton({
  onError,
  onSuccessRedirect = "/dashboard",
}) {
  useEffect(() => {
    let cancelled = false;

    function init() {
      if (cancelled) return;

      // ⏳ wait until Google script is ready
      if (!window.google || !window.google.accounts?.id) {
        setTimeout(init, 100);
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        onError?.("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const data = await apiRequest("/api/auth/google", {
              method: "POST",
              body: { credential: response.credential },
            });

            setAuth({
              token: data.token,
              userId8: data.user?.userId8,
            });

            window.location.href = onSuccessRedirect;
          } catch (e) {
            onError?.(e.message || "Google login failed");
          }
        },
      });

      const el = document.getElementById("google-login-btn");
      if (!el) return;

      el.innerHTML = "";

      window.google.accounts.id.renderButton(el, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
        shape: "pill",
      });
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [onError, onSuccessRedirect]);

  return (
    <div className="flex justify-center">
      <div
        id="google-login-btn"
        className="min-h-[44px]" // ensures space exists
      />
    </div>
  );
}
