import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(appUrl),
  applicationName: "FamilyFinance",
  title: {
    default: "FamilyFinance — household cash-flow planner",
    template: "%s · FamilyFinance",
  },
  description:
    "Plan household income, bills, and savings in PKR. See when cash may run short before the next payday.",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "FamilyFinance",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "FamilyFinance",
    description: "Household cash-flow planning for Pakistani families.",
    url: appUrl,
    siteName: "FamilyFinance",
    images: [{ url: "/og-cover.svg", width: 1200, height: 630, alt: "FamilyFinance" }],
    locale: "en_PK",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00A6D6" },
    { media: "(prefers-color-scheme: dark)", color: "#24364B" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-PK">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-bg font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
