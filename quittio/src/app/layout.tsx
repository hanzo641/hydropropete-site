import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, site } from "@/lib/site";
import "./globals.css";

// Polices auto-hébergées au build (aucune requête vers Google côté visiteur), sous-ensemble latin uniquement.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Quittio — Quittances de loyer automatiques et gestion locative simple",
    template: "%s | Quittio",
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    url: site.url,
    title: "Quittio — Vos loyers gérés en pilote automatique",
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#131318" },
  ],
};

const organization = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: site.name,
      url: site.url,
      logo: absoluteUrl("/icon.svg"),
      email: site.supportEmail,
      description: site.description,
      areaServed: "FR",
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: site.url,
      name: site.name,
      inLanguage: "fr-FR",
      publisher: { "@id": absoluteUrl("/#organization") },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          {children}
          <CookieConsent />
        </ThemeProvider>
        <JsonLd data={organization} />
      </body>
    </html>
  );
}
