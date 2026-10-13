import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="system-page">
      <section className="system-card" aria-labelledby="not-found-title">
        <div className="system-icon">
          <Icon name="search" size={26} />
        </div>
        <div>
          <span className="system-kicker">404 / Not found</span>
          <h1 id="not-found-title">That page isn&apos;t in this workspace</h1>
          <p>
            The page or document view you requested does not exist or may have been moved.
          </p>
        </div>
        <div className="system-actions">
          <Link href="/" className="system-primary-action">
            <Icon name="chat" className="w-4 h-4" />
            <span>Return to workspace</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

