import type { OverlayConfig } from './OverlayConfig';

/** Formatos JSON devolvidos pelas rotas /api/mapas (datas chegam como string). */
export type MapApiItem = {
  mapId?: string;
  id?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  address?: string;
  overlayConfig?: OverlayConfig | null;
  createdAt?: string;
  updatedAt?: string;
};
