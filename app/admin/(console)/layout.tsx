import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

// Defense-in-depth: this must never rely solely on middleware.ts to keep HR
// logins out of the internal staff console — verify the session directly
// here too, so a middleware miss (deploy race, edge-runtime quirk, etc.)
// can't leave this area reachable by anyone but Leadway staff.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.loginType !== 'staff') {
    redirect('/admin/login');
  }

  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[220px]">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
