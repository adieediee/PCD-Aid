import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, CircleHelp, Settings, Users, type LucideIcon } from 'lucide-react'
import { IconButton, MenuItem, Popover, usePopover } from './ui'
import QuickSearch from './QuickSearch'
import { ROLES } from '../labels'
import { useRole } from '../role'
import { useNotifications } from '../notifications'
import type { RoleId } from '../types'

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="10" fill="#0F1B33" />
        {/* stylised cilia */}
        <path d="M9 23c1-4 0-8 2-12M14 23c0-5 1-9 3-13M19 23c0-4 2-8 4-11" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">PCD Aid</span>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, active, badge }: { to: string; label: string; icon: LucideIcon; active: boolean; badge?: number }) {
  return (
    <Link
      to={to}
      className={`relative flex h-10 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors ${
        active ? 'bg-surface-muted text-ink-900' : 'text-ink-600 hover:text-ink-900'
      }`}
    >
      {active && <span className="absolute -left-4 h-6 w-[3px] rounded-r-full bg-ink-900" />}
      <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
      <span className="flex-1">{label}</span>
      {badge ? <span className="num rounded-full bg-ink-900 px-1.5 py-px text-[11px] font-semibold text-white">{badge}</span> : null}
    </Link>
  )
}

function Sidebar() {
  const { pathname } = useLocation()
  const onPatients = pathname.startsWith('/patients')
  const { role } = useRole()
  const unread = useNotifications(role).unread.length

  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-[248px] shrink-0 flex-col rounded-card bg-surface px-4 py-6">
      <Logo />
      <p className="mt-10 mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">Menu</p>
      <nav className="flex flex-col gap-1">
        <NavItem to="/patients" label="Pacienti" icon={Users} active={onPatients} />
        <NavItem to="/notifications" label="Notifikácie" icon={Bell} active={pathname === '/notifications'} badge={unread} />
      </nav>
      <p className="mt-8 mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">Všeobecné</p>
      <nav className="flex flex-col gap-1">
        <NavItem to="/settings" label="Nastavenia" icon={Settings} active={pathname === '/settings'} />
        <NavItem to="/help" label="Pomoc" icon={CircleHelp} active={pathname === '/help'} />
      </nav>
      <div className="mt-auto rounded-inner bg-surface-muted p-3 text-xs text-ink-600">
        <p className="font-medium text-ink-900">Prototyp</p>
        Všetky dáta sú fiktívne.
      </div>
    </aside>
  )
}

function RoleSwitcher() {
  const { role, setRole } = useRole()
  const { open, setOpen, ref } = usePopover()
  const current = ROLES[role]

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-surface-muted cursor-pointer">
        <span className="flex size-9 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">{current.initials}</span>
        <span className="text-left leading-tight">
          <span className="block text-sm font-medium">{current.name}</span>
          <span className="block text-xs text-ink-600">{current.title}</span>
        </span>
        <ChevronDown size={16} className="text-ink-400" />
      </button>
      {open && (
        <Popover className="right-0 w-64">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">Prepnúť rolu (prototyp)</p>
          {(Object.keys(ROLES) as RoleId[]).map((r) => (
            <MenuItem key={r} selected={r === role} onClick={() => { setRole(r); setOpen(false) }}>
              <span>{ROLES[r].name} <span className="text-ink-400">· {ROLES[r].title}</span></span>
            </MenuItem>
          ))}
        </Popover>
      )}
    </div>
  )
}

function Topbar() {
  const navigate = useNavigate()
  const { role } = useRole()
  const unread = useNotifications(role).unread.length
  return (
    <header className="flex h-16 items-center justify-between rounded-card bg-surface px-3 pl-4">
      <QuickSearch />
      <div className="flex items-center gap-2">
        <IconButton aria-label="Notifikácie" onClick={() => navigate('/notifications')}>
          <Bell size={18} strokeWidth={1.75} />
          {unread > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-bad ring-2 ring-surface" />}
        </IconButton>
        <RoleSwitcher />
      </div>
    </header>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-screen gap-4 p-4">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Topbar />
        <main className="flex-1 pb-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
