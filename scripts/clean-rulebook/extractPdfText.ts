/**
 * @fileoverview Extract raw text per page from a CSI rulebook PDF.
 *
 * Thin wrapper over `pdfjs-dist`'s Node-safe legacy build. Returns one string
 * per page in document order, preserving only the rendered text. Layout
 * semantics (columns, figure positions) are NOT preserved — we rely on the
 * source's numbered-rule markers for downstream slicing, not on coordinates.
 *
 * Why the "legacy/build/pdf.mjs" import: pdfjs-dist v5 ships two bundles.
 * The default browser bundle pulls DOM globals; the legacy bundle runs under
 * Node without polyfills. This script runs via `tsx` under Node, so we need
 * the legacy bundle.
 */

// @ts-expect-error -- pdfjs-dist's legacy bundle has no bundled type decls.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfPage = {
  /** 1-based page number. */
  page: number;
  /** Concatenated text content of the page, items joined with single spaces. */
  text: string;
};

/**
 * Read a PDF file from disk and return its text content, one entry per page.
 *
 * @param absolutePath - Absolute path to the PDF on the operator's machine.
 * @returns Array of { page, text } in source order. Empty pages include an
 *          empty `text` string rather than being dropped, so page numbers
 *          remain meaningful as `sourcePage` references.
 */
export async function extractPdfText(absolutePath: string): Promise<PdfPage[]> {
  const doc = await getDocument({ url: absolutePath }).promise;
  const pages: PdfPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // pdfjs-dist returns `items` where each item has a `str`. Non-text items
    // (e.g., markers) have empty str, so a simple join is safe.
    const text = content.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ');
    pages.push({ page: i, text });
  }

  return pages;
}
