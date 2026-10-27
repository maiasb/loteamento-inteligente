import type { LotStatus } from './LotStatus';

export type LotApiItem = {
  id: string;
  mapId: string;
  blockId: string | null;
  blockName: string | null;
  lotNumber: string;
  status: LotStatus;
  price: number;
  pricePerM2: number | null;
  size: number;
  description: string;
  features: string[];
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
};
