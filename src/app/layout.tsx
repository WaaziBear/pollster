import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted to avoid next/font/google's build-time fetch, which fails on
// Vercel when Google serves extensionless font URLs (TypeError: Cannot read
// properties of null). Variable font covers the full 300-800 weight range.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "300 800",
});

export const metadata: Metadata = {
  title: "Pollster — create and share polls",
  description:
    "Create polls with varied question types, invite people by email, and view aggregated results.",
};

// Applied before hydration so a stored/system dark preference never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
