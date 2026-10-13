import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#07090E] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-[#0D121F] border border-white/10 p-8 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Icon name="search" className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-medium uppercase tracking-widest text-indigo-400">
            404 - Page Not Found
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Requested Resource Missing
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The page or document view you requested does not exist or may have been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Icon name="chat" className="w-4 h-4" />
            <span>Return to Workspace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

