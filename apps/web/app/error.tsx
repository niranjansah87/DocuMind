"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/icons";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error to client console or monitoring sink
    console.error("[DocuMind ErrorBoundary caught]:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-[#0D121F] border border-red-500/20 p-8 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <Icon name="alert-circle" className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Application Error Encountered
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            An unexpected error occurred while rendering this view. Your documents and chat history remain safe.
          </p>
        </div>

        {error.digest && (
          <div className="text-xs font-mono bg-black/40 text-slate-500 py-1.5 px-3 rounded-lg border border-white/5">
            Error ID: {error.digest}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
          >
            Back to Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
