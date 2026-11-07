'use client'

import { useAuth } from '@/context/AuthContext'
import NavItem from '@/components/layout/NavItem'
import { navItems } from '@/components/layout/navItems'

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-52 flex-col border-r border-line bg-surface p-6 md:flex">
      <p className="mb-8 text-xl font-extrabold tracking-tight">Monify</p>

      <ul className="flex flex-1 flex-col gap-3">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavItem
              href={item.to}
              exact={item.to === '/'}
              className={(isActive) =>
                `text-sm font-semibold ${
                  item.to === '/add' ? 'text-acc' : isActive ? 'text-ink' : 'text-mute hover:text-ink'
                }`
              }
            >
              {item.to === '/add' ? `+ ${item.label}` : item.label}
            </NavItem>
          </li>
        ))}
      </ul>

      <p className="truncate text-xs text-mute">{user?.email}</p>
    </aside>
  )
}
