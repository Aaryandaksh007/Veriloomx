import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const loraSerif = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VeriLoom AI — Intelligent Brand Governance & Explainable Compliance",
  description:
    "Pre-publication content auditing, citation-grounded remediation, and a demo approval workflow. Built by Team opopopxxnot for the We Code Coders Hackathon.",
  keywords: [
    "brand governance",
    "compliance",
    "WCAG",
    "CIELAB",
    "RAG",
    "content auditing",
    "VeriLoom",
  ],
  authors: [{ name: "Aaryan Sharma — Team opopopxxnot" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${loraSerif.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          {children}
          <Toaster />
          <Sonner position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
