"use client";

import { cn } from "@/lib/utils";
import { Mic, Square, Loader2, RotateCcw } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { USE_API, apiTranscribeAudio } from "@/lib/api";
import { useI18n } from "@/i18n";

interface PushToTalkProps {
  onTranscript?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function PushToTalk({ onTranscript, disabled = false, className }: PushToTalkProps) {
  const { t, locale } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);

  const isSecureContext = typeof window !== "undefined" && window.isSecureContext;

  const startRecording = useCallback(async () => {
    if (disabled || isRecording) return;
    setError(null);
    setTranscript("");

    if (!USE_API) {
      // Mock mode: simulate transcript after 2s
      setIsRecording(true);
      setTimeout(() => {
        const mockText = "Famille en bonne santé, besoin de provisions alimentaires.";
        setTranscript(mockText);
        setIsRecording(false);
      }, 2000);
      return;
    }

    // getUserMedia requires HTTPS (or localhost) — show clear message on HTTP LAN
    if (!isSecureContext) {
      setError(t("sttRequiresHttps"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setError(t("sttNoAudio"));
          return;
        }

        lastBlobRef.current = blob;
        setIsProcessing(true);
        const { data, error: apiError } = await apiTranscribeAudio(blob, locale);
        setIsProcessing(false);

        if (data?.text) {
          setTranscript(data.text);
        } else {
          setError(apiError ?? t("sttError"));
        }
      };

      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? t("sttPermissionDenied")
          : t("sttMicUnavailable")
      );
    }
  }, [disabled, isRecording, t, locale]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  const handleRetry = useCallback(async () => {
    if (!lastBlobRef.current) {
      startRecording();
      return;
    }
    setError(null);
    setIsProcessing(true);
    const { data, error: apiError } = await apiTranscribeAudio(lastBlobRef.current, locale);
    setIsProcessing(false);
    if (data?.text) {
      setTranscript(data.text);
    } else {
      setError(apiError ?? t("sttError"));
    }
  }, [startRecording, t, locale]);

  const handleConfirm = useCallback(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
    setTranscript("");
    setIsRecording(false);
    lastBlobRef.current = null;
  }, [transcript, onTranscript]);

  const handleClear = useCallback(() => {
    setTranscript("");
    setIsRecording(false);
    setError(null);
    lastBlobRef.current = null;
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Main record button */}
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? t("sttStopRecording") : t("sttStartRecording")}
        className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-[var(--transition-base)] cursor-pointer",
          "min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)]",
          isRecording
            ? "bg-[var(--critical)] text-[var(--on-critical)] animate-pulse shadow-[var(--elevation-4)]"
            : "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] shadow-[var(--elevation-3)]",
          (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isProcessing ? <Loader2 size={32} className="animate-spin" /> : isRecording ? <Square size={32} /> : <Mic size={32} />}
      </button>

      {/* Status text with aria-live */}
      <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
        {isProcessing ? t("sttProcessing") : isRecording ? t("sttRecording") : t("sttStart")}
      </p>

      {/* Error + retry */}
      {error && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-[var(--critical)]" role="alert">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)] cursor-pointer min-h-[var(--touch-target-min)]"
          >
            <RotateCcw size={14} />
            {t("sttRetry")}
          </button>
        </div>
      )}

      {/* Transcript preview + confirm/clear */}
      {transcript && (
        <div className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <p className="text-sm text-[var(--text-primary)] mb-2">{transcript}</p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              className="px-3 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] cursor-pointer min-h-[var(--touch-target-min)]"
            >
              {t("sttConfirm")}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)] cursor-pointer min-h-[var(--touch-target-min)]"
            >
              {t("sttClear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
