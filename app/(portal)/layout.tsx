import { Sidebar } from '@/components/layout/Sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F1F2F8]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[220px]">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
