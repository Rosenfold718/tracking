import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Отслеживание позы — AI Body Tracker",
  description: "Реалтайм-трекинг тела, рук, ног и головы через камеру. Построено на MediaPipe от Google.",
  keywords: ["pose tracking", "MediaPipe", "body tracking", "камера", "трекинг позы", "AI"],
  authors: [{ name: "Rosenfold718" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Отслеживание позы — AI Body Tracker",
    description: "Реалтайм-трекинг тела через камеру с помощью MediaPipe AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
