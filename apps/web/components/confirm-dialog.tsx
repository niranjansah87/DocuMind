"use client";

import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./icons";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="confirm-dialog-backdrop" onClick={onCancel} role="presentation">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="confirm-dialog-card"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
          >
            <div className="confirm-dialog-header">
              <div className={`confirm-dialog-icon ${variant}`}>
                <Icon name={variant === "danger" ? "trash" : "alert-circle"} size={20} />
              </div>
              <div className="confirm-dialog-text">
                <h3 id="confirm-dialog-title" className="confirm-dialog-title">
                  {title}
                </h3>
                <p id="confirm-dialog-desc" className="confirm-dialog-desc">
                  {description}
                </p>
              </div>
            </div>

            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="confirm-dialog-btn cancel"
                onClick={onCancel}
                disabled={busy}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`confirm-dialog-btn ${variant === "danger" ? "danger" : "primary"}`}
                onClick={() => void onConfirm()}
                disabled={busy}
              >
                {busy ? "Processing..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

