export type OverlayConfig = {
  imageUrl: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  opacity: number;
  rotation: number;
};
