"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/i18n";
import { Card, Button } from "@/components/ds";
import { Camera, CheckCircle2, XCircle, ScanLine } from "lucide-react";

interface QRScannerConfirmProps {
  /** The expected feeling code (6-char short code) to match against */
  expectedCode: string;
  /** Called when the scan matches the expected code */
  onConfirmed: () => void;
}

export default function QRScannerConfirm({ expectedCode, onConfirmed }: QRScannerConfirmProps) {
  const { t } = useI18n();
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "mismatch">("idle");
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current && !stoppedRef.current) {
      stoppedRef.current = true;
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch {
        // ignore
      }
      html5QrRef.current = null;
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setResult("idle");
    stoppedRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scannerId = "qr-scanner-confirm";

      // Ensure container exists
      if (!scannerRef.current) return;
      scannerRef.current.id = scannerId;

      const scanner = new Html5Qrcode(scannerId);
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          // Extract code from URL or raw text
          let scannedCode = decodedText.trim();

          // If it's a URL like .../feeling?code=ABC123
          const urlMatch = scannedCode.match(/[?&]code=([A-Z0-9]{6})/i);
          if (urlMatch) {
            scannedCode = urlMatch[1].toUpperCase();
          }

          if (scannedCode.toUpperCase() === expectedCode.toUpperCase()) {
            setResult("success");
            stopScanner();
            setScanning(false);
            setTimeout(() => onConfirmed(), 800);
          } else {
            setResult("mismatch");
          }
        },
        () => {
          // QR not found in frame — ignore
        }
      );

      setScanning(true);
    } catch (err: any) {
      setError(err?.message || "Camera access denied");
      setScanning(false);
    }
  }, [expectedCode, onConfirmed, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <Card className="flex flex-col items-center gap-[var(--space-4)]">
      <h3 className="text-base font-medium text-[var(--text-primary)] flex items-center gap-2">
        <ScanLine size={20} />
        {t("scanConfirmTitle")}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] text-center">
        {t("scanConfirmDesc")}
      </p>

      {/* Scanner viewport */}
      <div
        ref={scannerRef}
        className="w-full max-w-[300px] aspect-square rounded-[var(--radius-lg)] overflow-hidden bg-[var(--bg-tertiary)]"
      />

      {/* Result feedback */}
      {result === "success" && (
        <div className="flex items-center gap-2 text-[var(--success)]">
          <CheckCircle2 size={24} />
          <span className="font-semibold">{t("scanSuccess")}</span>
        </div>
      )}
      {result === "mismatch" && (
        <div className="flex items-center gap-2 text-[var(--warning)]">
          <XCircle size={24} />
          <span className="text-sm">{t("scanMismatch")}</span>
        </div>
      )}
      {error && (
        <p className="text-sm text-[var(--critical)]">{error}</p>
      )}

      {/* Controls */}
      {!scanning && result !== "success" && (
        <Button variant="primary" size="md" icon={<Camera size={18} />} onClick={startScanner}>
          {t("scanStart")}
        </Button>
      )}
      {scanning && (
        <Button variant="secondary" size="sm" onClick={() => { stopScanner(); setScanning(false); }}>
          {t("scanStop")}
        </Button>
      )}
    </Card>
  );
}
