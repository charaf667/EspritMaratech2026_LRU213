"use client";

import { cn } from "@/lib/utils";
import { Paperclip, X, Download } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { apiDownloadAttachmentUrl } from "@/lib/api";

interface AttachmentChipProps {
  filename: string;
  /** Attachment ID for download (if available from API) */
  attachmentId?: string;
  onRemove?: () => void;
  /** Show download action */
  downloadable?: boolean;
  className?: string;
}

export default function AttachmentChip({ filename, attachmentId, onRemove, downloadable, className }: AttachmentChipProps) {
  const { t } = useI18n();
  const [holdProgress, setHoldProgress] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(() => {
    if (!onRemove) return;
    setHoldProgress(true);
    holdTimerRef.current = setTimeout(() => {
      setHoldProgress(false);
      onRemove();
    }, 800);
  }, [onRemove]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(false);
  }, []);

  const downloadUrl = attachmentId ? apiDownloadAttachmentUrl(attachmentId) : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 h-[var(--height-chip)] px-3 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] text-sm",
        className
      )}
    >
      <Paperclip size={14} className="text-[var(--text-tertiary)] shrink-0" aria-hidden="true" />
      <span className="truncate max-w-[150px] text-[var(--text-primary)]">{filename}</span>

      {/* Download button */}
      {downloadable && downloadUrl && (
        <a
          href={downloadUrl}
          download={filename}
          aria-label={`${t("attachDownload")} ${filename}`}
          className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--primary)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] flex items-center justify-center"
        >
          <Download size={14} />
        </a>
      )}

      {/* Hold-to-confirm delete button */}
      {onRemove && (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-label={`${t("delete")} ${filename}`}
          title={t("attachHoldToDelete")}
          className={cn(
            "shrink-0 text-[var(--text-tertiary)] hover:text-[var(--critical)] cursor-pointer min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] flex items-center justify-center -mr-2 transition-transform",
            holdProgress && "scale-125 text-[var(--critical)]"
          )}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
