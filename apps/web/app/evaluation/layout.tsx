import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evaluation",
  description: "Internal retrieval and answer quality benchmark dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EvaluationLayout({ children }: { children: React.ReactNode }) {
  return children;
}

