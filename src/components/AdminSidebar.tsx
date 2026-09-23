import React from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Clock,
  FileCheck,
  ArrowLeft,
  Shield,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface AdminSidebarProps {
  pendingCount?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ pendingCount = 0 }) => {
  const { currentPath, navigate } = useRouter();
  const { currentUser } = useAuth();

  const isCR = currentUser.role === 'cr' || currentUser.studentId === '250221';
  const isACR = currentUser.role === 'acr' || currentUser.studentId === '250236';

  const links = [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    {
      label: 'Pending Queue',
      path: '/admin/pending',
      icon: Clock,
      count: pendingCount,
    },
    { label: 'All Resources', path: '/admin/resources', icon: FileCheck },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 bg-white border border-stone-200 rounded-md p-4 space-y-5">
      {/* Header: Private Console Badge */}
      <div className="pb-3 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-stone-900 text-white rounded">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-stone-900 tracking-wide uppercase">
              Moderation Console
            </h2>
            <p className="text-[11px] text-stone-500 font-mono">Private Internal</p>
          </div>
        </div>
        <Lock className="w-3.5 h-3.5 text-stone-400" />
      </div>

      {/* Active Moderator Identity */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
            Active Moderator
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
              isCR
                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                : 'bg-blue-100 text-blue-900 border border-blue-200'
            }`}
          >
            {isCR ? 'BATCH CR' : isACR ? 'BATCH ACR' : 'MODERATOR'}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold text-stone-900 leading-tight">
            {currentUser.name}
          </p>
          <p className="text-[11px] text-stone-500 font-mono">
            {currentUser.email || (isCR ? '250221@ku.ac.bd' : '250236@ku.ac.bd')}
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = currentPath === link.path;
          return (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors ${
                isActive
                  ? 'bg-stone-900 text-white font-semibold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                <span>{link.label}</span>
              </div>
              {link.count !== undefined && link.count > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold tabular-nums ${
                    isActive ? 'bg-stone-800 text-white' : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {link.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Exit to Public Interface */}
      <div className="pt-3 border-t border-stone-100">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Public Archive</span>
        </button>
      </div>
    </aside>
  );
};
