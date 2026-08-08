import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: "Sika - Smart Personal Finance Manager",
    template: "%s | Sika"
  },
  description:
    "Track expenditures, manage church givings, and gain financial insights with AI-powered receipt scanning. Simple, secure, and smart finance management.",
  keywords: [
    "personal finance",
    "budget tracking",
    "expense tracker",
    "church giving",
    "tithe tracking",
    "receipt scanner",
    "AI finance",
    "money management",
    "financial insights"
  ],
  authors: [{ name: "Sika" }],
  creator: "Sika",
  publisher: "Sika",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Sika - Smart Personal Finance Manager",
    description:
      "Track expenditures, manage church givings, and gain financial insights with AI-powered receipt scanning.",
    siteName: "Sika",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sika - Personal Finance Manager"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sika - Smart Personal Finance Manager",
    description:
      "Track expenditures, manage church givings, and gain financial insights with AI-powered receipt scanning.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  },
  verification: {
    // Add these when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale: capping it blocks pinch zoom, which fails WCAG 1.4.4.
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
