import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw } from "lucide-react";
import { Modal, Spinner } from "./ui";

/** In-browser camera using getUserMedia. Falls back to the file picker if the camera is unavailable. */
export function CameraCapture({ open, onClose, onCapture, onFallback }: { open: boolean; onClose: () => void; onCapture: (b: Blob) => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let s: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((ms) => {
        if (cancelled) return ms.getTracks().forEach((t) => t.stop());
        s = ms;
        setStream(ms);
        if (video.current) video.current.srcObject = ms;
      })
      .catch(() => setError("Camera access isn't available. You can pick a photo instead."));
    if (!navigator.mediaDevices) setError("Camera access isn't available in this browser. You can pick a photo instead.");
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [open, facing]);

  function snap() {
    const v = video.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.9);
  }

  return (
    <Modal open={open} onClose={onClose} title="Take a photo" wide>
      {error ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-ink-2">{error}</p>
          <button className="btn-primary" onClick={onFallback}>
            Choose photo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            {!stream && (
              <div className="absolute inset-0 grid place-items-center">
                <Spinner />
              </div>
            )}
            <video ref={video} autoPlay playsInline muted className="size-full object-cover" />
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/30" />
          </div>
          <div className="flex items-center justify-center gap-4">
            <button className="btn-ghost" onClick={() => setFacing(facing === "environment" ? "user" : "environment")} aria-label="Switch camera">
              <RefreshCcw className="size-4" />
            </button>
            <button className="btn-primary size-16 rounded-full p-0" onClick={snap} disabled={!stream} aria-label="Capture photo">
              <Camera className="size-7" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
