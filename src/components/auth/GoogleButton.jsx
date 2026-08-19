"use client";

import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { setAuth } from "@/lib/auth/storage";

export default function GoogleButton({
  onError,
  onSuccessRedirect = "/dashboard",
}) {
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    function init() {
      if (cancelled) return;

      // ⏳ wait until Google script is ready
      if (!window.google || !window.google.accounts?.id) {
        timerId = setTimeout(init, 100);
        return;
      }

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        onError?.("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
        return;
      }

      if (!initializedRef.current) {
        try {
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
          initializedRef.current = true;
        } catch (err) {
          // ignore repeat init error
        }
      }

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
      if (timerId) clearTimeout(timerId);
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
