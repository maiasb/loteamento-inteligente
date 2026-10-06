import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** false na renderização do servidor e na hidratação; true depois que o componente monta no cliente. */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
