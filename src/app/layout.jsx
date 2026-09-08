import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { deploymentLabel, titleFor } from "@/lib/deploymentLabel";
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

const BASE_TITLE = "apowerb — All-in-One Agentic by thaink\u00b2";

// The tab has to say which deployment it holds: production, dev and a local
// server used to be three identical tabs. Read from the served host, so the
// same image names itself correctly wherever it runs.
export async function generateMetadata() {
  const label = deploymentLabel((await headers()).get("host"), process.env.DEPLOYMENT_LABEL);
  return {
    title: titleFor(BASE_TITLE, label),
    description: "Build, orchestrate and monitor AI agents",
    icons: {
      icon: "/favicon.ico",
      apple: "/thaink2_logo_circle.png",
    },
  };
}

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
