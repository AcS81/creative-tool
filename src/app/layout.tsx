import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-variable",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-variable",
});

export const metadata: Metadata = {
  title: "CreatorSight",
  description: "Paste a YouTube URL to preview your creative fingerprint.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
