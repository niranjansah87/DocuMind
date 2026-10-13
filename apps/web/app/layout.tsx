import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import "./styles.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://documind.niranjansah87.com.np";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DocuMind - Enterprise Document Assistant & Grounded RAG",
    template: "%s | DocuMind",
  },
  description:
    "AI-powered document Q&A assistant featuring token-aware chunking, pgvector hybrid search, grounded citations, and human-in-the-loop agent tools.",
  keywords: [
    "DocuMind",
    "RAG",
    "Document AI",
    "Vector Search",
    "pgvector",
    "Hybrid Retrieval",
    "Document Q&A",
    "Enterprise AI",
  ],
  authors: [{ name: "VanarX Tech / Bikash Saud" }],
  creator: "VanarX Tech",
  publisher: "DocuMind",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "DocuMind",
    title: "DocuMind - Enterprise Document Assistant & Grounded RAG",
    description:
      "Grounded document Q&A with pgvector hybrid retrieval, inline verifiable citations, and transactional agent tools.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "DocuMind Workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DocuMind - Enterprise Document Assistant & Grounded RAG",
    description: "Grounded document Q&A with pgvector hybrid search and verifiable citations.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
