import Icon from '@/components/ui/Icon'
import NavItem from '@/components/layout/NavItem'
import { navItems } from '@/components/layout/navItems'

// Pengaturan tidak masuk bottom nav (cukup 5 menu); aksesnya lewat ikon di header.
const mobileItems = navItems.filter((item) => item.to !== '/settings')

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {mobileItems.map((item) => (
          <li key={item.to}>
            {item.to === '/add' ? (
              // Tombol tambah dibuat menonjol di tengah
              <NavItem href="/add" className="flex flex-col items-center py-1.5" aria-label="Tambah transaksi">
                <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg">
                  <Icon name="plus" />
                </span>
              </NavItem>
            ) : (
              <NavItem
                href={item.to}
                exact={item.to === '/'}
                className={(isActive) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                    isActive ? 'text-teal-600' : 'text-slate-500'
                  }`
                }
              >
                <Icon name={item.icon} className="h-6 w-6" />
                {item.label}
              </NavItem>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
