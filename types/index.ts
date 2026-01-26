export interface Coordinate {
  x: number;
  y: number;
}

export interface GeoCoordinate {
  lat: number;
  lng: number;
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
  blockId?: string; // ID da quadra/bloco (opcional)
  blockName?: string; // Nome da quadra associada (opcional)
  mapName?: string; // Nome do mapa associado (opcional)
  lotNumber: string;
  status: LotStatus;
  price: number;
  pricePerM2?: number; // Preço por metro quadrado
  size: number; // Área em m²
  description?: string;
  features?: string[];
  coordinates?: GeoCoordinate[]; // Coordenadas do polígono no Google Maps
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id: string;
  mapId: string;
  name: string;
  description?: string;
  coordinates?: GeoCoordinate[]; // Coordenadas do polígono da quadra no Google Maps
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
  boundaryCoordinates?: GeoCoordinate[]; // Coordenadas do polígono que delimita a área do loteamento
  centerLat?: number; // Latitude central (depreciado, use boundaryCoordinates)
  centerLng?: number; // Longitude central (depreciado, use boundaryCoordinates)
  zoom?: number; // Zoom do mapa (depreciado)
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
