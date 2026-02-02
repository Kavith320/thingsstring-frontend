"use client";

import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex min-h-screen relative">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-950 md:hidden shadow-2xl transform transition-transform animate-in slide-in-from-left duration-300 ring-1 ring-white/10">
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />

          <main className="w-full min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
