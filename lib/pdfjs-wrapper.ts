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
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }

  return pdfjsLib;
}

export function isPdfJsAvailable(): boolean {
  return typeof window !== 'undefined';
}
