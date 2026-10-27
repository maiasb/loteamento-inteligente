import type { OverlayConfig } from './OverlayConfig';

export type Map = {
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
};
