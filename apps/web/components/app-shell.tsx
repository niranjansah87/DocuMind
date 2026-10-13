"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Icon } from "./icons";
import { getAppMeta } from "@/lib/api";
import { getAuthToken, getTenantId } from "@/lib/auth";

import {
  listConversations,
  getActiveConversationId,
  setActiveConversationId,
  deleteConversation,
  type Conversation,
} from "@/lib/conversations";

const navItems = [
  { href: "/", label: "Chat", icon: "chat" as const },
  { href: "/documents", label: "Documents", icon: "documents" as const },
  { href: "/evaluation", label: "Evaluation", icon: "evaluation" as const, badge: "Beta" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantLabel, setTenantLabel] = useState<string>("Reviewer Scope");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  useEffect(() => {
    const syncConversations = () => {
      setConversations(listConversations());
      setActiveConvId(getActiveConversationId());
    };

    syncConversations();
    window.addEventListener("storage", syncConversations);
    window.addEventListener("documind:conversations-changed", syncConversations);
    return () => {
      window.removeEventListener("storage", syncConversations);
      window.removeEventListener("documind:conversations-changed", syncConversations);
    };
  }, []);

  useEffect(() => {
    const updateLabel = () => {
      const tid = getTenantId();
      const token = getAuthToken();
      let next = "Reviewer Scope";
      if (tid && tid !== "00000000-0000-0000-0000-000000000001") {
        next = `Tenant ${tid.slice(0, 8)}`;
      } else if (token) {
        next = "API Key Auth";
      }
      setTenantLabel((prev) => (prev !== next ? next : prev));
    };

    updateLabel();
    window.addEventListener("storage", updateLabel);
    window.addEventListener("documind:auth-changed", updateLabel);
    return () => {
      window.removeEventListener("storage", updateLabel);
      window.removeEventListener("documind:auth-changed", updateLabel);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;

    let isMounted = true;
    void (async () => {
      try {
        const meta = await getAppMeta();
        if (isMounted && meta.auth_required) {
          const token = getAuthToken();
          if (!token) {
            toast.error("Authentication required. Redirecting to login...", {
              id: "appshell-auth-guard",
              duration: 3500,
            });
            router.push("/login");
          }
        }
      } catch {
        // Handled by api.ts interceptor
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      if (pathname !== "/login") {
        router.push("/login");
      }
    };
    window.addEventListener("documind:unauthorized", handleUnauthorizedEvent);
    return () => window.removeEventListener("documind:unauthorized", handleUnauthorizedEvent);
  }, [pathname, router]);

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

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        {/* Top brand header */}
        <div className="sidebar-header">
          <Link className="sidebar-brand" href="/" aria-label="DocuMind home">
            <Image src="/logo_mark.png" alt="" width={34} height={34} priority />
            <span className="brand-wordmark">DocuMind</span>
          </Link>
          <span className="brand-edition">RAG</span>
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
          <div className="flex items-center justify-between px-2 pb-2">
              <span className="recent-heading p-0">Recent conversations</span>
            {conversations.length > 0 && (
              <span className="text-[10px] text-slate-400 font-mono font-medium">
                {conversations.length}
              </span>
            )}
          </div>

          {conversations.length === 0 ? (
            <div className="recent-empty-state">
              <Icon name="chat" size={16} />
              <span>Start a new chat to begin.</span>
            </div>
          ) : (
            <div className="recent-list">
              {conversations.slice(0, 15).map((conv) => {
                const isSelected = pathname === "/" && activeConvId === conv.id;
                const formattedTime = new Date(conv.updatedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={conv.id}
                    className={`recent-item group ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setActiveConversationId(conv.id);
                      if (pathname !== "/") {
                        router.push(`/?conversation=${conv.id}`);
                      } else {
                        window.dispatchEvent(
                          new CustomEvent("documind:load-conversation", { detail: conv.id }),
                        );
                      }
                    }}
                    title={conv.title}
                  >
                    <div className="recent-info min-w-0 flex-1">
                      <span className="recent-title">{conv.title}</span>
                      <span className="recent-time">
                        {conv.documentName ? `${conv.documentName} • ` : ""}
                        {formattedTime}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="recent-menu-btn opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"
                      title="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                        toast.success("Conversation deleted");
                      }}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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

      <div id="main-content" className="app-content">
        {children}
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
