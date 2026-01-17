import ProtectedClient from "@/components/common/ProtectedClient";

export default function DashboardLayout({ children }) {
  return <ProtectedClient>{children}</ProtectedClient>;
}