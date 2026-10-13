import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documents",
  description: "Private document management and indexed chunk repository.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

