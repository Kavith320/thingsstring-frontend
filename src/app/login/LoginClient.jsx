import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
