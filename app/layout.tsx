import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { WorkspaceProviders } from '@/components/workspace-providers'

export const metadata: Metadata = {
  metadataBase: new URL('https://getmednexus.vercel.app'),
  title: 'MedNexus — Clinical Q-Bank',
  description:
    'MedNexus is a premium clinical education Q-Bank for medical students and clinicians. Practice high-yield vignettes in tutor or timed exam mode.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'MedNexus',
    title: 'MedNexus — Clinical Q-Bank',
    description: 'Study clinical MCQs and Theory Vault content online or offline with MedNexus.',
    images: [{ url: '/mednexus-social-preview.jpg', width: 1200, height: 630, alt: 'MedNexus clinical study app' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedNexus — Clinical Q-Bank',
    description: 'Study clinical MCQs and Theory Vault content online or offline with MedNexus.',
    images: ['/mednexus-social-preview.jpg'],
  },
  appleWebApp: { capable: true, title: 'MedNexus', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="overflow-x-hidden font-sans antialiased text-foreground">
        <WorkspaceProviders>{children}</WorkspaceProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
