'use client';

/**
 * Wrapper para carregar PDF.js apenas no cliente
 * Evita erros de SSR com canvas
 */

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

export async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded on the client side');
  }

  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }

  return pdfjsLib;
}

export function isPdfJsAvailable(): boolean {
  return typeof window !== 'undefined';
}
