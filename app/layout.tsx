// FILE PATH: bank_cdms_dashboard/app/layout.tsx — REPLACE EXISTING

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { DashboardProvider } from "@/context/DashboardContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Data Analytics - Ripplr",
  description: "CDMS - Bank - Sales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        style={{ background: "#f1f5f9", minHeight: "100vh" }}
      >
        <DashboardProvider>
          <Nav />
          <main style={{ maxWidth: "1600px", margin: "0 auto", padding: "20px 20px" }}>
            {children}
          </main>
        </DashboardProvider>
      </body>
    </html>
  );
}