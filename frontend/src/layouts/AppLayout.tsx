import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function AppLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen bg-[#0f1115]">
      <div className="fixed top-0 left-0 bottom-0 w-64 z-30">
        <Sidebar />
      </div>
      <main className="flex-1 ml-64 p-8 overflow-auto min-h-screen">
        <Breadcrumbs />
        <Outlet />
      </main>
    </div>
  );
}
