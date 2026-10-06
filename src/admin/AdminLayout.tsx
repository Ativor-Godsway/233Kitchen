import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MoreHorizontal,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Logo } from '../components/Logo';
import { Dialog } from '../components/ui/Dialog';
import { useNewOrderAlerts } from './useNewOrderAlerts';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/prep', label: 'Prep sheet', icon: ClipboardList },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/admin/emails', label: 'Email log', icon: Mail },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];
const MOBILE_TABS = NAV.slice(0, 4);
const MOBILE_MORE = NAV.slice(4);

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-ghana-red px-1.5 text-[11px] font-semibold text-white">{n}</span>;
}

export function AdminLayout({ email }: { email: string }) {
  const { newCount, sound, setSound } = useNewOrderAlerts(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const logout = async () => {
    await api('/admin/logout', { method: 'POST' }).catch(() => undefined);
    qc.setQueryData(['admin', 'me'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'admin' && q.queryKey[1] !== 'me' });
    navigate('/admin/login', { replace: true });
  };

  const SoundBtn = (
    <button
      type="button"
      onClick={() => setSound(!sound)}
      className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      aria-label={sound ? 'Mute new-order sound' : 'Turn on new-order sound'}
      title={sound ? 'Sound on for new orders' : 'Sound off'}
    >
      {sound ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
    </button>
  );

  return (
    <div className="admin min-h-screen bg-neutral-50 text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo size={36} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">+233 Kitchen</p>
            <p className="text-xs text-neutral-500">Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )
              }
            >
              <Icon size={18} aria-hidden />
              {label}
              {to === '/admin/orders' && <Badge n={newCount} />}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            <ExternalLink size={16} aria-hidden /> View site
          </a>
          <div className="mt-1 flex items-center gap-2 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-xs text-neutral-500" title={email}>
              {email}
            </p>
            {SoundBtn}
            <button type="button" onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Log out">
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-sm font-semibold">+233 Admin</span>
        </div>
        {SoundBtn}
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Admin">
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-neutral-900' : 'text-neutral-500')
                }
              >
                <Icon size={20} aria-hidden />
                {label.replace(' sheet', '')}
                {to === '/admin/orders' && newCount > 0 && (
                  <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ghana-red px-1 text-[10px] font-semibold text-white">{newCount}</span>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMoreOpen(true)} className="flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-neutral-500">
              <MoreHorizontal size={20} aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" variant="sheet" className="!md:max-w-sm">
        <MoreMenu onNavigate={() => setMoreOpen(false)} onLogout={logout}>
          {MOBILE_MORE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-neutral-50">
              <Icon size={18} aria-hidden /> {label}
            </NavLink>
          ))}
        </MoreMenu>
      </Dialog>
    </div>
  );
}

function MoreMenu({ children, onLogout, onNavigate }: { children: ReactNode; onLogout: () => void; onNavigate: () => void }) {
  return (
    <div className="space-y-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {children}
      <a href="/" target="_blank" rel="noopener" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-neutral-50">
        <ExternalLink size={18} aria-hidden /> View site
      </a>
      <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ghana-red hover:bg-red-50">
        <LogOut size={18} aria-hidden /> Log out
      </button>
    </div>
  );
}
