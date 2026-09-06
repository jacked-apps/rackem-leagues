/**
 * @fileoverview Export the join QR as a file the organizer can drop into a
 * flyer (Unit C3).
 *
 * Printing our sign covers "tape it to the wall", but an organizer making their
 * own flyer needs the code as an asset in Canva, Docs, Publisher, whatever. Two
 * formats, because they are not interchangeable:
 *
 *  • SVG — vector, so it stays crisp blown up to a full poster. The right
 *    choice for print, and what a real design tool wants.
 *  • PNG — a plain raster image, accepted everywhere including tools that
 *    reject SVG. Exported at a deliberately large size so it survives print.
 *
 * Right-clicking the code on the page is NOT a substitute: browsers only offer
 * "copy image" on an <img>, and ours is an inline <svg>.
 */

/** PNG export size in pixels. Large on purpose — a flyer QR gets printed. */
const PNG_SIZE = 1024;

/**
 * Turn a tournament name into a safe, recognisable download filename.
 *
 * @param name - The tournament name, which is free text and may be anything.
 * @param extension - 'svg' or 'png'.
 *
 * @example
 * qrFileName('Friday 9-Ball!', 'png') // 'friday-9-ball-join-qr.png'
 */
export function qrFileName(name: string, extension: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // An unnamed (or entirely punctuation) tournament still needs a filename.
  return `${slug || 'tournament'}-join-qr.${extension}`;
}

/**
 * Serialize an on-page <svg> into a standalone SVG document string.
 *
 * The namespace has to be added explicitly: inline SVG in HTML doesn't need
 * `xmlns`, but a saved .svg file is parsed as XML and won't open without it.
 */
export function svgToString(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

/** Hand the browser a blob as a named download. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Save the code as a vector file — the one to use for a printed flyer. */
export function downloadQrSvg(svg: SVGSVGElement, tournamentName: string): void {
  const blob = new Blob([svgToString(svg)], { type: 'image/svg+xml' });
  saveBlob(blob, qrFileName(tournamentName, 'svg'));
}

/**
 * Save the code as a large PNG, for tools that won't take SVG.
 *
 * Rasterizing goes through an <img> + <canvas> because there is no direct
 * SVG-to-PNG API. The image load is async, so this returns a promise the caller
 * can await to know the file was actually produced.
 */
export function downloadQrPng(svg: SVGSVGElement, tournamentName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const source = svgToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create the image.'));
        return;
      }
      // The QR's own background rect is white, but fill anyway so a transparent
      // export can never come out as an unscannable code on a dark flyer.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.drawImage(image, 0, 0, PNG_SIZE, PNG_SIZE);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not create the image.'));
          return;
        }
        saveBlob(blob, qrFileName(tournamentName, 'png'));
        resolve();
      }, 'image/png');
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('Could not create the image.'));
    };

    image.src = svgUrl;
  });
}
