import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./styles.css";

export const metadata: Metadata = {
  title: "DocuMind",
  description: "Document-grounded answers and controlled tools",
  openGraph: { title: "DocuMind", description: "Grounded answers with visible evidence" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
