"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "@/components/icons";
import type { Citation } from "@/lib/types";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

/**
 * Detects Python list repr like ['item1', 'item2'] or ["item1", "item2"]
 * and converts it to proper Markdown bullet list.
 * This is a frontend safety net for LLM output that slips through the prompt.
 */
function normalizePythonListRepr(text: string): string {
  const trimmed = text.trim();
  // Match a top-level Python list: starts with [ ends with ] and contains quoted strings
  const pythonListPattern = /^\[(?:\s*(?:'[^']*'|"[^"]*")\s*,?\s*)+\]$/s;
  if (!pythonListPattern.test(trimmed)) return text;
  try {
    // Extract all quoted strings from the list
    const itemPattern = /(?:'([^']*)'|"([^"]*)")/g;
    const items: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(trimmed)) !== null) {
      items.push(match[1] ?? match[2] ?? "");
    }
    if (items.length > 0) {
      return items.map((item) => `- ${item}`).join("\n");
    }
  } catch {
    // fall through
  }
  return text;
}

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang-tag">{lang || "code"}</span>
        <button
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
          type="button"
        >
          <Icon name="copy" size={13} />
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="code-pre-tag">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
  citations = [],
  onCitationClick,
}: MarkdownRendererProps) {
  const normalizedContent = normalizePythonListRepr(content);

  return (
    <div className="markdown-prose-container">
      <div className="markdown-prose-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const isInline = !className && !String(children).includes("\n");
              if (isInline) {
                return (
                  <code className="inline-code-badge" {...props}>
                    {children}
                  </code>
                );
              }
              return <CodeBlock className={className}>{children}</CodeBlock>;
            },
            table({ children }) {
              return (
                <div className="table-responsive-wrapper">
                  <table className="md-table">{children}</table>
                </div>
              );
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-link"
                >
                  {children}
                </a>
              );
            },
            blockquote({ children }) {
              return <blockquote className="md-blockquote">{children}</blockquote>;
            },
            h1({ children }) {
              return <h1 className="md-h1">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="md-h2">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="md-h3">{children}</h3>;
            },
            ul({ children }) {
              return <ul className="md-ul">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="md-ol">{children}</ol>;
            },
            li({ children }) {
              return <li className="md-li">{children}</li>;
            },
            hr() {
              return <hr className="md-hr" />;
            },
            p({ children }) {
              return <p className="md-p">{children}</p>;
            },
          }}
        >
          {normalizedContent}
        </ReactMarkdown>
        {isStreaming && (
          <span className="chatgpt-streaming-cursor" aria-hidden="true" />
        )}
      </div>

      {citations && citations.length > 0 && (
        <div className="citations-tray">
          <div className="citations-tray-label">
            <Icon name="file" size={13} />
            <span>Sources ({citations.length})</span>
          </div>
          <div className="citations-tray-list">
            {citations.map((c, idx) => (
              <button
                key={c.chunk_id || idx}
                type="button"
                className="citation-tray-badge"
                onClick={() => onCitationClick?.(c)}
                title={`View chunk: ${c.section ?? c.document_name}`}
              >
                <span className="citation-num">{idx + 1}</span>
                <span className="citation-name">{c.document_name}</span>
                {c.section && <span className="citation-sec">• {c.section}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
