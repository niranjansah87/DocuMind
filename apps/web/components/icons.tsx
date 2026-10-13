type IconName = "chat" | "documents" | "evaluation" | "settings" | "search" | "upload" | "send" | "trash" | "file" | "plus" | "close" | "check";

const paths: Record<IconName, React.ReactNode> = {
  chat: <><path d="M5 6.5h14v9H9l-4 3v-12Z"/><path d="M8 10h8M8 13h5"/></>,
  documents: <><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h5"/></>,
  evaluation: <><path d="M5 19V9M12 19V4M19 19v-7"/><path d="M3 19.5h18"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>,
  upload: <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v6h14v-6"/></>,
  send: <><path d="m4 5 16 7-16 7 3-7-3-7Z"/><path d="M7 12h13"/></>,
  trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  file: <><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
