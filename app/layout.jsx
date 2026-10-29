import { Inter } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { FlashProvider } from '@/context/FlashContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { THEME_KEY } from '@/utils/theme'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' })

export const metadata = {
  title: 'Monify',
  icons: { icon: '/favicon.svg' },
}

export const viewport = {
  themeColor: '#0d9488',
}

// Pasang tema sebelum halaman tampil, supaya tidak berkedip putih saat refresh
const themeScript = `try {
  var t = localStorage.getItem('${THEME_KEY}')
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch (e) {}`

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <FlashProvider>{children}</FlashProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
