/**
 * @fileoverview Browser file-download helpers.
 *
 * Small, dependency-free utilities to push generated content (CSV, XLSX, JSON,
 * etc.) to the user as a downloaded file. Kept generic so any feature can reuse
 * them — the first caller is the LMS schedule export (`src/utils/lmsExport/`).
 */

/** Click a temporary object-URL anchor for `blob`, then clean it up. */
function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of in-memory text content (no network round-trip).
 *
 * @param filename - Suggested download filename (e.g. `schedule.csv`).
 * @param content  - The file's text content.
 * @param mimeType - MIME type for the Blob (default CSV/UTF-8).
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8',
): void {
  triggerDownload(filename, new Blob([content], { type: mimeType }));
}

/**
 * Trigger a browser download of in-memory binary content (e.g. a generated
 * .xlsx). The bytes are copied into a fresh ArrayBuffer so the Blob gets a
 * plain `ArrayBuffer` (not a `SharedArrayBuffer`-typed view).
 *
 * @param filename - Suggested download filename (e.g. `schedule.xlsx`).
 * @param bytes    - The file's raw bytes.
 * @param mimeType - MIME type for the Blob.
 */
export function downloadBytes(filename: string, bytes: Uint8Array, mimeType: string): void {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  triggerDownload(filename, new Blob([copy.buffer], { type: mimeType }));
}
