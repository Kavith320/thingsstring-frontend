import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
