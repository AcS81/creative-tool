import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
