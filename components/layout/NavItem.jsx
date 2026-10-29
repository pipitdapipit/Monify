'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pengganti NavLink: className menerima isActive.
// exact = hanya aktif di path yang sama persis (dipakai untuk Beranda "/").
export default function NavItem({ href, exact = false, className, children, ...props }) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  const classes = typeof className === 'function' ? className(isActive) : className
  return (
    <Link href={href} className={classes} aria-current={isActive ? 'page' : undefined} {...props}>
      {children}
    </Link>
  )
}
