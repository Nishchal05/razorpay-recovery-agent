import { AuthGuard } from '../../components/auth/AuthGuard';
import { Sidebar } from '../../components/layout/Sidebar';
import { AppHeader } from '../../components/layout/AppHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
