import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Tiririka Protocol | Pay-Per-Litre Water on Solana Payment Channels",
  description:
    "Decentralized pay-per-litre water kiosk protocol designed for Nairobi informal settlements (Mathare & Kibera). 99.8% gas fee savings via off-chain Ed25519 payment channels with offline local verification.",
  keywords: [
    "Solana",
    "Payment Channels",
    "Micropayments",
    "Nairobi",
    "Water Kiosk",
    "Ed25519",
    "DeFi",
    "MLH Hackathon",
    "IoT",
  ],
  authors: [{ name: "Prince Nzamuwe", url: "https://github.com/princenzmw" }],
  creator: "Prince Nzamuwe",
  publisher: "Tiririka Protocol",
  metadataBase: new URL("https://tiririka.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tiririka.vercel.app",
    title: "Tiririka Protocol | Pay-Per-Litre Water on Solana",
    description:
      "Sub-cent water micropayments for African water ATMs. Cryptographic Ed25519 vouchers allow water to keep flowing even when cellular connectivity drops.",
    siteName: "Tiririka Protocol",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tiririka Protocol - Pay-Per-Litre Water on Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tiririka Protocol | Pay-Per-Litre Water on Solana",
    description:
      "Solving sub-cent micropayments for Nairobi water kiosks via Solana payment channels. 99.8% fee savings.",
    creator: "@princenzmw",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
