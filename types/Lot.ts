import type { LotStatus } from './LotStatus';

export type Lot = {
  id: string;
  mapId: string;
  blockId?: string | null; // ID da quadra/bloco (opcional)
  blockName?: string | null; // Nome da quadra associada (opcional)
  mapName?: string; // Nome do mapa associado (opcional)
  lotNumber: string;
  status: LotStatus;
  price: number;
  pricePerM2?: number | null; // Preço por metro quadrado
  size: number; // Área em m²
  description?: string;
  features?: string[];
  lat?: number | null; // Latitude do centro do círculo no mapa
  lng?: number | null; // Longitude do centro do círculo no mapa
  createdAt: Date;
  updatedAt: Date;
};
