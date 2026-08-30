import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? (process.env.NEXT_PUBLIC_SITE_URL.startsWith('http') ? process.env.NEXT_PUBLIC_SITE_URL : `https://${process.env.NEXT_PUBLIC_SITE_URL}`)
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://thisiskeyo.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Keyo — Extract Keys Instantly",
    template: "%s | Keyo",
  },
  description: "Bypass shortener countdowns and extract access keys instantly with a single click.",
  applicationName: "Keyo",
  authors: [{ name: "Keyo Team", url: "https://t.me/Rrryomenn" }],
  generator: "Next.js",
  keywords: [
    "Keyo",
    "key extractor",
    "link shortener bypass",
    "lksfy bypass",
    "nanolinks bypass",
    "arolinks bypass",
    "adrinolinks bypass",
    "telegram bot key",
    "instant key generator"
  ],
  creator: "Rrryomenn",
  publisher: "Keyo",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/favicon.ico" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/images/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Keyo",
    title: "Keyo — Extract Keys Instantly",
    description: "Bypass shortener countdowns and extract access keys instantly with a single click.",
    images: [
      {
        url: "/images/og.png",
        width: 1200,
        height: 630,
        alt: "Keyo — Extract Keys Instantly",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keyo — Extract Keys Instantly",
    description: "Bypass shortener countdowns and extract access keys instantly with a single click.",
    images: ["/images/og.png"],
    creator: "@Rrryomenn",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Keyo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen antialiased select-none font-sans text-white">
        {children}
      </body>
    </html>
  );
}
