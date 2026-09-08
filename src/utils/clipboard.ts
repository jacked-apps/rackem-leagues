/**
 * @fileoverview Copy text to the clipboard, everywhere it actually needs to work.
 *
 * `navigator.clipboard` is only available in a SECURE CONTEXT — HTTPS or
 * localhost. Reaching a dev server by its LAN address (192.168.x.x) to test on
 * a phone is not one, and neither are some embedded browsers, so the modern API
 * throws and a naive copy button silently fails exactly where sharing a link
 * matters most.
 *
 * The throwaway-textarea fallback is deprecated but still works in every
 * browser we care about, and it needs no permission or secure context.
 *
 * Lifted from ShareAppCard, which had the only correct implementation, so the
 * rest of the app stops re-deriving it (badly).
 */

/**
 * Copy text, using whichever mechanism the browser actually allows.
 *
 * @param text - What to place on the clipboard.
 * @returns true if it was copied; false if every route failed, so the caller
 *   can offer the text some other way rather than claiming success.
 *
 * @example
 * if (!(await copyText(url))) toast.error('Could not copy — here is the link…');
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Insecure context (a LAN IP, an embedded webview) — the old way still works.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Off-screen but focusable: select() does nothing on a display:none node.
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
