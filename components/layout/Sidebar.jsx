'use client'

import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/ui/Icon'
import NavItem from '@/components/layout/NavItem'
import { navItems } from '@/components/layout/navItems'

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-bold text-white">M</span>
        <span className="text-lg font-bold text-slate-800">Monify</span>
      </div>

      <ul className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavItem
              href={item.to}
              exact={item.to === '/'}
              className={(isActive) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavItem>
          </li>
        ))}
      </ul>

      <p className="truncate px-3 text-xs text-slate-400">{user?.email}</p>
    </aside>
  )
}
