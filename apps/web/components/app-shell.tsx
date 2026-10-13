"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./icons";
import { getAuthToken, getTenantId } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Chat", icon: "chat" as const },
  { href: "/documents", label: "Documents", icon: "documents" as const },
  { href: "/evaluation", label: "Evaluation", icon: "evaluation" as const, badge: "Beta" },
];

const recentConversations = [
  { id: "refund-policy", title: "Refund policy details", time: "2m ago", prompt: "What is the refund policy?" },
  { id: "order-status", title: "Order status ORD-1001", time: "12m ago", prompt: "What is the status of order ORD-1001?" },
  { id: "support-ticket", title: "Create support ticket", time: "1h ago", prompt: "I need to open a support ticket for my delayed shipment" },
  { id: "warranty-info", title: "Warranty information", time: "3h ago", prompt: "What is covered by warranty?" },
  { id: "pricing-plans", title: "Pricing and plans", time: "1d ago", prompt: "What payment methods are supported?" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeRecent, setActiveRecent] = useState<string>("refund-policy");
  const [tenantLabel, setTenantLabel] = useState<string>("Reviewer Scope");

  useEffect(() => {
    const tid = getTenantId();
    const token = getAuthToken();
    if (tid && tid !== "00000000-0000-0000-0000-000000000001") {
      setTenantLabel(`Tenant ${tid.slice(0, 8)}`);
    } else if (token) {
      setTenantLabel("API Key Auth");
    } else {
      setTenantLabel("Reviewer Scope");
    }
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/?new=true");
        window.dispatchEvent(new CustomEvent("documind:new-chat"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleNewChat = () => {
    router.push("/?new=true");
    window.dispatchEvent(new CustomEvent("documind:new-chat"));
  };

  const handleSelectRecent = (item: (typeof recentConversations)[number]) => {
    setActiveRecent(item.id);
    router.push(`/?prompt=${encodeURIComponent(item.prompt)}`);
    window.dispatchEvent(new CustomEvent("documind:load-prompt", { detail: item.prompt }));
  };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* Top brand header */}
        <div className="sidebar-header">
          <Link className="sidebar-brand" href="/" aria-label="DocuMind Home">
            <Image
              src="/logo.png"
              alt="DocuMind"
              width={132}
              height={36}
              priority
              style={{ objectFit: "contain" }}
            />
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <Icon name="chevron-up" size={16} />
          </motion.button>
        </div>

        {/* New Chat Button */}
        <motion.button
          className="new-chat-button"
          onClick={handleNewChat}
          title="Start new chat (Ctrl+K)"
          whileHover={{ scale: 1.01, boxShadow: "0 4px 14px rgba(61, 76, 255, 0.28)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="new-chat-label">
            <Icon name="plus" size={16} />
            <span>New Chat</span>
          </div>
          <span className="shortcut-badge">Ctrl K</span>
        </motion.button>

        {/* Primary navigation */}
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-link ${active ? "active" : ""}`}
                style={{ position: "relative" }}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-indicator"
                    className="sidebar-active-indicator"
                    initial={false}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon name={item.icon} size={18} />
                <span className="sidebar-nav-text" style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
                {item.badge && <span className="nav-beta-badge" style={{ position: "relative", zIndex: 1 }}>{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Recent Conversations */}
        <div className="recent-conversations-section">
          <div className="recent-heading">RECENT CONVERSATIONS</div>
          <div className="recent-list">
            <AnimatePresence initial={false}>
              {recentConversations.map((item, index) => {
                const isSelected = pathname === "/" && activeRecent === item.id;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`recent-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectRecent(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectRecent(item);
                      }
                    }}
                  >
                    <div className="recent-info">
                      <span className="recent-title">{item.title}</span>
                      <span className="recent-time">{item.time}</span>
                    </div>
                    {isSelected && (
                      <button
                        className="recent-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        aria-label="Conversation options"
                      >
                        <Icon name="more" size={14} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className="sidebar-user-footer">
          <Link href="/login" className="block text-inherit no-underline">
            <motion.div
              whileHover={{ scale: 1.01, backgroundColor: "var(--ink-100)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="user-profile-card cursor-pointer"
              title="Manage workspace authentication and credentials"
            >
              <div className="user-avatar">{tenantLabel.startsWith("Tenant") ? "T" : "D"}</div>
              <div className="user-details">
                <span className="user-name">Niranjan Sah</span>
                <span className="user-workspace flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                  <span className="truncate">{tenantLabel}</span>
                </span>
              </div>
              <div className="user-dropdown-icon">
                <Icon name="tune" size={14} />
              </div>
            </motion.div>
          </Link>
        </div>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  );
}
