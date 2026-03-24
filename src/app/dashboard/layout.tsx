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
      {/* pt-14: モバイルヘッダーの高さ分、lg:pt-0: デスクトップではヘッダーなし */}
      <main className="pt-14 lg:pt-0 lg:ml-64 p-4 lg:p-8 pb-16">{children}</main>
      <PlanSwitcherWrapper />
    </div>
  );
}
