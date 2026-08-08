"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

export type PolishToast = {
  id: string;
  tone: "success" | "error" | "info";
  title: string;
  message?: string;
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: PolishToast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast-card toast-${toast.tone}`} key={toast.id}>
          <span className="toast-icon">
            {toast.tone === "success" ? (
              <CheckCircle2 size={17} />
            ) : toast.tone === "error" ? (
              <AlertTriangle size={17} />
            ) : (
              <Sparkles size={17} />
            )}
          </span>

          <div>
            <strong>{toast.title}</strong>
            {toast.message && <p>{toast.message}</p>}
          </div>

          <button
            className="toast-dismiss"
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="polish-empty-state">
      <div className="polish-empty-icon">{icon ?? <Inbox size={24} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button className="button button-dashboard" type="button" onClick={onAction}>
          <Sparkles size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton-avatar" />
          <div className="skeleton-lines">
            <span />
            <span />
            <span />
          </div>
          <span className="skeleton-pill" />
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-dialog">
        <div className={`confirm-icon confirm-${tone}`}>
          <AlertTriangle size={22} />
        </div>
        <div className="confirm-copy">
          <h3 id="confirm-title">{title}</h3>
          <p>{description}</p>
        </div>
        <div className="confirm-actions">
          <button className="button" type="button" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "button button-danger" : "button button-dashboard"}
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <LoaderCircle className="spin" size={16} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BulkActionBar({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="bulk-action-bar">
      <div>
        <strong>{selectedCount} selected</strong>
        <span>Apply a stage update, export a smaller list, or delete safely.</span>
      </div>
      <div className="bulk-actions">{children}</div>
      <button className="icon-button" type="button" onClick={onClear} aria-label="Clear selection">
        <X size={16} />
      </button>
    </div>
  );
}
