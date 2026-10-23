"use client";

import { useCallback, useState } from "react";

// Copy text to the clipboard and flash a `copied` flag for ~1.5s. Shared by the wallet-address
// copy control and the detail-page share-link button. No-ops if the clipboard is unavailable
// (insecure context / denied permission).
export function useCopied(resetMs = 1500): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    (text: string) => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), resetMs);
        } catch {
          // Clipboard unavailable — no-op.
        }
      })();
    },
    [resetMs],
  );
  return { copied, copy };
}
