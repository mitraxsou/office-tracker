import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PwC Office Pulse | Office Tracker",
  description: "Track your 5-hour office presence via Wi-Fi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
