import { Map } from '@/types/Map';
import { Lot } from '@/types/Lot';
import { PurchaseRequest } from '@/types/PurchaseRequest';
import { LotStatus } from '@/types/LotStatus';

const STORAGE_KEYS = {
  MAPS: 'lot_platform_maps',
  LOTS: 'lot_platform_lots',
  PURCHASES: 'lot_platform_purchases',
  INITIALIZED: 'lot_platform_initialized',
};

// Dados de exemplo para testes
const initializeSampleData = (): void => {
  if (typeof window === 'undefined') return;

  const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (isInitialized) return;

  // Criar mapa de exemplo
  const sampleMap: Map = {
    id: '1762192028364',
    name: 'Mapa de Exemplo - Imobiliária Vale dos Carajás',
    description: 'Mapa de exemplo para testes. Substitua pela imagem real.',
    imageUrl:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjQwMCIgeT0iMzAwIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5NYXBhIGRlIEV4ZW1wbG88L3RleHQ+PC9zdmc+',
    imageType: 'image',
    width: 800,
    height: 600,
    createdAt: new Date('2024-11-03T10:00:00'),
    updatedAt: new Date('2024-11-03T10:00:00'),
  };

  // Criar lotes de exemplo
  const sampleLots: Lot[] = [
    {
      id: '1',
      mapId: '1762192028364',
      lotNumber: '1',
      size: 250,
      price: 50000,
      status: LotStatus.AVAILABLE,
      description: 'Lote de exemplo 1',
      createdAt: new Date('2024-11-03T10:00:00'),
      updatedAt: new Date('2024-11-03T10:00:00'),
    },
    {
      id: '2',
      mapId: '1762192028364',
      lotNumber: '2',
      size: 250,
      price: 55000,
      status: LotStatus.AVAILABLE,
      description: 'Lote de exemplo 2',
      createdAt: new Date('2024-11-03T10:00:00'),
      updatedAt: new Date('2024-11-03T10:00:00'),
    },
    {
      id: '3',
      mapId: '1762192028364',
      lotNumber: '3',
      size: 250,
      price: 52000,
      status: LotStatus.RESERVED,
      description: 'Lote de exemplo 3',
      createdAt: new Date('2024-11-03T10:00:00'),
      updatedAt: new Date('2024-11-03T10:00:00'),
    },
  ];

  // Salvar dados de exemplo
  localStorage.setItem(STORAGE_KEYS.MAPS, serializeData([sampleMap]));
  localStorage.setItem(STORAGE_KEYS.LOTS, serializeData(sampleLots));
  localStorage.setItem(STORAGE_KEYS.PURCHASES, serializeData([]));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const serializeData = (data: any) => {
  return JSON.stringify(data, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });
};

export const deserializeData = (jsonString: string) => {
  return JSON.parse(jsonString, (key, value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  });
};

// Maps
export const getMaps = (): Map[] => {
  if (typeof window === 'undefined') return [];

  // Inicializar dados de exemplo se necessário
  initializeSampleData();

  const data = localStorage.getItem(STORAGE_KEYS.MAPS);
  return data ? deserializeData(data) : [];
};

export const saveMap = (map: Map): void => {
  if (typeof window === 'undefined') return;
  const maps = getMaps();
  const index = maps.findIndex((m) => m.id === map.id);
  if (index >= 0) {
    maps[index] = map;
  } else {
    maps.push(map);
  }

  try {
    const serializedData = serializeData(maps);
    localStorage.setItem(STORAGE_KEYS.MAPS, serializedData);
  } catch (error) {
    console.error('Erro ao salvar mapa:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error(
        'Arquivo muito grande para o localStorage. Use uma imagem menor ou de menor qualidade.'
      );
    }
    throw error;
  }
};

export const deleteMap = (id: string): void => {
  if (typeof window === 'undefined') return;
  const maps = getMaps().filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEYS.MAPS, serializeData(maps));

  const lots = getLots().filter((l) => l.mapId !== id);
  localStorage.setItem(STORAGE_KEYS.LOTS, serializeData(lots));
};

export const getMapById = (id: string): Map | undefined => {
  return getMaps().find((m) => m.id === id);
};

export const getLots = (): Lot[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.LOTS);
  return data ? deserializeData(data) : [];
};

export const getLotsByMapId = (mapId: string): Lot[] => {
  return getLots().filter((l) => l.mapId === mapId);
};

export const saveLot = (lot: Lot): void => {
  if (typeof window === 'undefined') return;
  const lots = getLots();
  const index = lots.findIndex((l) => l.id === lot.id);
  if (index >= 0) {
    lots[index] = lot;
  } else {
    lots.push(lot);
  }
  localStorage.setItem(STORAGE_KEYS.LOTS, serializeData(lots));
};

export const deleteLot = (id: string): void => {
  if (typeof window === 'undefined') return;
  const lots = getLots().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEYS.LOTS, serializeData(lots));
};

export const getLotById = (id: string): Lot | undefined => {
  return getLots().find((l) => l.id === id);
};

export const getPurchaseRequests = (): PurchaseRequest[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
  return data ? deserializeData(data) : [];
};

export const savePurchaseRequest = (purchase: PurchaseRequest): void => {
  if (typeof window === 'undefined') return;
  const purchases = getPurchaseRequests();
  purchases.push(purchase);
  localStorage.setItem(STORAGE_KEYS.PURCHASES, serializeData(purchases));
};

export const updatePurchaseRequestStatus = (
  id: string,
  status: PurchaseRequest['status']
): void => {
  if (typeof window === 'undefined') return;
  const purchases = getPurchaseRequests();
  const index = purchases.findIndex((p) => p.id === id);
  if (index >= 0) {
    purchases[index].status = status;
    localStorage.setItem(STORAGE_KEYS.PURCHASES, serializeData(purchases));
  }
};
