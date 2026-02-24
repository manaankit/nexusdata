import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Quality Dashboard",
  description: "Monitor and improve your database quality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
