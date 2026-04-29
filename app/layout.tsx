import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Commercial Analytics – CDMS",
  description: "Collection Summary Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ background: "#f1f5f9", minHeight: "100vh" }}>
        <Nav />
        <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "20px 20px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}