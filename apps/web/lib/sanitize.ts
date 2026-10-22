// React escapes text children by default, but NOT URL attribute schemes. Any
// attacker-controlled URL (campaign link/image) rendered into href/src MUST pass
// through here first. Parse via URL() — never substring checks.

const SAFE_PROTOCOLS = new Set(["https:", "mailto:"]);

/** Return the URL string only if it uses a safe scheme; otherwise null. Blocks
 * javascript:, data:, vbscript:, and relative/invalid URLs. */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  try {
    const url = new URL(s);
    return SAFE_PROTOCOLS.has(url.protocol) ? s : null;
  } catch {
    return null;
  }
}
