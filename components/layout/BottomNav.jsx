import NavItem from '@/components/layout/NavItem'
import { navItems } from '@/components/layout/navItems'

// Pengaturan tidak masuk bottom nav (cukup 5 menu); aksesnya lewat "Atur" di header.
const mobileItems = navItems.filter((item) => item.to !== '/settings')

export default function BottomNav() {
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5 items-center px-2">
        {mobileItems.map((item) => (
          <li key={item.to}>
            {item.to === '/add' ? (
              <NavItem href="/add" className="flex justify-center py-2" aria-label="Tambah transaksi">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-acc text-xl leading-none text-on-acc">
                  +
                </span>
              </NavItem>
            ) : (
              <NavItem
                href={item.to}
                exact={item.to === '/'}
                className={(isActive) =>
                  `block py-4 text-center text-xs font-semibold ${isActive ? 'text-ink' : 'text-mute'}`
                }
              >
                {item.label}
              </NavItem>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
