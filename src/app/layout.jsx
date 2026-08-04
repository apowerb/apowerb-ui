import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextNavigationProvider } from "@/lib/NextNavigationProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "apowerb — All-in-One Agentic by thaink\u00b2",
  description: "Build, orchestrate and monitor AI agents",
  icons: {
    icon: "/favicon.ico",
    apple: "/thaink2_logo_circle.png",
  },
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextIntlClientProvider>
          <NextNavigationProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </NextNavigationProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
