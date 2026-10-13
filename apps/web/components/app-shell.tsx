"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logo from "../../../public/logo.png";
import { Icon } from "./icons";

const nav = [
  { href: "/", label: "Workspace", icon: "chat" as const },
  { href: "/documents", label: "Documents", icon: "documents" as const },
  { href: "/evaluation", label: "Evaluation", icon: "evaluation" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="logo" href="/" aria-label="DocuMind workspace">
          <Image src={logo} alt="DocuMind" priority sizes="150px" />
        </Link>
        <nav aria-label="Primary navigation">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="scope-badge"><span>DM</span><div><strong>Demo workspace</strong><small>Single-user scope</small></div></div>
          <div className="secure-note"><Icon name="check" size={15} /> Sources stay server-side</div>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
