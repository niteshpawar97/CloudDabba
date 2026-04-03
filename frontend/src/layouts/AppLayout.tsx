import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function AppLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen bg-[#0f1115]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Breadcrumbs />
        <Outlet />
      </main>
    </div>
  );
}
