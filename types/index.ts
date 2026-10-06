export interface Coordinate {
  x: number;
  y: number;
}

export interface OverlayConfig {
  imageUrl: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  opacity: number;
  rotation: number;
}

export interface LotArea {
  points: Coordinate[]; // Polígono definindo a área do lote
}

export enum LotStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  BLOCKED = 'blocked',
}

export interface Lot {
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
}

export interface Block {
  id: string;
  mapId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Map {
  id: string;
  name: string;
  description?: string;
  imageUrl: string; // URL da imagem ou PDF convertido
  imageType: 'image' | 'pdf';
  width: number;
  height: number;
  address?: string; // Endereço do loteamento
  overlayConfig?: OverlayConfig | null; // Configuração do overlay SVG/imagem sobre o Google Maps
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseRequestLot {
  id: string;
  lotId: string;
  purchaseRequestId: string;
  agreedPrice?: number;
  firstPayment?: number; // Valor de entrada específico para este lote
  installments?: number; // Número de parcelas específico para este lote
  createdAt: Date;
}

export interface PurchaseRequest {
  id: string;
  lotId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCPF?: string;
  message?: string;
  contract?: string;
  status: 'pending' | 'contacted' | 'completed' | 'cancelled';
  createdAt: Date;
  lots?: PurchaseRequestLot[]; // Lotes associados com suas informações específicas
}

export enum UserRole {
  DEV = 'dev',
  ADMIN = 'admin',
  VENDEDOR = 'vendedor',
}

export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  creci?: string;
  role: UserRole;
  status: UserStatus;
  active?: boolean;
  password?: string;
  theme_preference?: 'light' | 'dark';
  createdAt: Date;
  updatedAt: Date;
}

/** Formatos JSON devolvidos pelas rotas /api/mapas (datas chegam como string). */
export interface MapApiItem {
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
}

export interface BlockApiItem {
  id: string;
  mapId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LotApiItem {
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
}

/** Lote dentro de uma reserva, como devolvido por /api/reservas. */
export interface ReservationLotSummary {
  id: string | number;
  lot_id?: string | number;
  agreed_price?: number | string | null;
  first_payment?: number | string | null;
  installments?: number | null;
  payment_method?: string | null;
}

/** Reserva resumida, como devolvida por /api/reservas. */
export interface ReservationSummary {
  id: string | number;
  customer_name: string;
  seller_name: string;
  status: string;
  created_at: string;
  user_id?: number | string | null;
  lots?: ReservationLotSummary[];
}
