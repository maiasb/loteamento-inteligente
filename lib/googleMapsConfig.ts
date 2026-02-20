/**
 * Configuração compartilhada do Google Maps.
 *
 * O @react-google-maps/api usa referência da array para detectar mudanças.
 * Definir aqui garante que todos os componentes usam a MESMA referência,
 * evitando o warning "You have provided a new libraries prop to useLoadScript."
 */
export const GOOGLE_MAPS_LIBRARIES: ("drawing" | "places")[] = ["drawing", "places"];
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
