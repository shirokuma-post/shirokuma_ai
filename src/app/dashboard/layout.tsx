import { Sidebar } from "@/components/layout/sidebar";
import { PlanSwitcherWrapper } from "@/components/admin/plan-switcher-wrapper";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8 pb-16">{children}</main>
      <PlanSwitcherWrapper />
    </div>
  );
}
