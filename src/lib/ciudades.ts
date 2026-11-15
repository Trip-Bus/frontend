/**
 * Códigos cortos de ciudad para los pases y encabezados (como en un tablero de terminal).
 * Son los códigos IATA de cada ciudad; si una ciudad no está, se usan sus tres primeras letras.
 */
const CODIGOS: Record<string, string> = {
  armenia: 'AXM',
  barranquilla: 'BAQ',
  bogota: 'BOG',
  bucaramanga: 'BGA',
  cali: 'CLO',
  cartagena: 'CTG',
  cucuta: 'CUC',
  ibague: 'IBE',
  manizales: 'MZL',
  medellin: 'MDE',
  monteria: 'MTR',
  neiva: 'NVA',
  pasto: 'PSO',
  pereira: 'PEI',
  popayan: 'PPN',
  'santa marta': 'SMR',
  tunja: 'TUN',
  valledupar: 'VUP',
  villavicencio: 'VVC',
}

export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** "Medellín" → "MDE"; "San Gil" → "SAN". */
export function codigoCiudad(nombre: string | null | undefined): string {
  const n = normalizar(nombre ?? '')
  if (!n) return '—'
  return CODIGOS[n] ?? n.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()
}
