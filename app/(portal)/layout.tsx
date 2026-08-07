import { Sidebar } from '@/components/layout/Sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F1F2F8]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[240px]">
        {/* overflow-x-hidden is a backstop, not a fix. If any child ever becomes
            un-shrinkable: a grid track, a flex item missing min-width:0, a long
            upstream error string: it would widen this column and put the whole
            document into horizontal scroll. Individual causes are fixed at their
            source; this keeps one from breaking the page frame again. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
