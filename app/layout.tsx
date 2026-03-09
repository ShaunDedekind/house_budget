import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { ClerkProvider } from '@clerk/nextjs'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import './globals.css'

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Home Base',
  description: 'Household finance tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Home Base',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${geist.variable} font-[family-name:var(--font-geist)] antialiased bg-zinc-50 text-zinc-900`}>
        <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/setup">
          <ServiceWorkerRegister />
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
