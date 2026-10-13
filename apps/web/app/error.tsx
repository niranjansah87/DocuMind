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
    <main className="system-page">
      <section className="system-card" aria-labelledby="error-title">
        <div className="system-icon danger">
          <Icon name="alert-circle" size={26} />
        </div>
        <div>
          <span className="system-kicker">Workspace interrupted</span>
          <h1 id="error-title">We couldn&apos;t open this view</h1>
          <p>
            An unexpected error occurred while rendering this view. Your documents and chat history remain safe.
          </p>
        </div>

        {error.digest && (
          <div className="system-code">
            Error ID: {error.digest}
          </div>
        )}
        <div className="system-actions">
          <button onClick={() => reset()} className="system-primary-action">
            Try again
          </button>
          <Link href="/" className="system-secondary-action">
            Back to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
