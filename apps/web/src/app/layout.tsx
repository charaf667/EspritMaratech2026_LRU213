import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n";
import { AuthProvider } from "@/lib/auth-context";
import { A11yProvider } from "@/lib/accessibility-context";
import { ThemeProvider } from "@/lib/theme-context";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMNIA Charity Tracking",
  description: "Field operations tracking for charity aid distribution",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0066CC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <ThemeProvider>
            <A11yProvider>
              <I18nProvider defaultLocale="fr">{children}</I18nProvider>
            </A11yProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
