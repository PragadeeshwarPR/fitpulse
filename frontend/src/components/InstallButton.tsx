import { Download, Share } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { useInstallPrompt } from "../hooks/usePwa";
import { Modal } from "./ui";

export function InstallButton({ compact, className }: { compact?: boolean; className?: string }) {
  const { canInstall, installed, iosHint, install } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  if (installed || (!canInstall && !iosHint)) return null;
  return (
    <>
      <button
        onClick={() => (canInstall ? install() : setIosOpen(true))}
        className={clsx(compact ? "btn-ghost px-3 py-1.5 text-xs" : "btn-ghost w-full", className)}
      >
        <Download className="size-4" /> Install app
      </button>
      <Modal open={iosOpen} onClose={() => setIosOpen(false)} title="Install FitPulse">
        <ol className="space-y-3 text-sm text-ink-2">
          <li>
            1. Tap the <Share className="inline size-4 text-ink" /> <b className="text-ink">Share</b> button in Safari.
          </li>
          <li>
            2. Choose <b className="text-ink">Add to Home Screen</b>.
          </li>
          <li>3. Open FitPulse from your home screen for the full-screen app experience.</li>
        </ol>
      </Modal>
    </>
  );
}
