import bogota from '@/assets/ciudades/bogota.jpg'
import bucaramanga from '@/assets/ciudades/bucaramanga.jpg'
import cali from '@/assets/ciudades/cali.jpg'
import cartagena from '@/assets/ciudades/cartagena.jpg'
import medellin from '@/assets/ciudades/medellin.jpg'
import tunja from '@/assets/ciudades/tunja.jpg'
import villavicencio from '@/assets/ciudades/villavicencio.jpg'
import { normalizar } from '@/lib/ciudades'

/**
 * "Ciudad de fondo" (lienzo de diseño "TripBus — Ciudad de fondo"): cada destino trae su foto y un
 * color de acento sacado de ella. Reglas:
 *  - Los acentos son claros (luminancia > 0.25): siempre llevan texto tinta encima (≥ 4.5:1).
 *  - `velo` y `veloMedio` oscurecen la parte de arriba de la foto para que el título blanco se lea
 *    (más fuerte en fotos de día con cielo claro).
 *  - `pos` es el `object-position` de la foto en cada pantalla (portada completa, franja, pase).
 *  - Una ciudad sin foto usa el fondo tinta y el acento hueso.
 * Agregar una ciudad: foto vertical (o horizontal con el tema al centro) de ~720–1400 px de ancho,
 * ≤ 180 KB, en src/assets/ciudades/, y una entrada aquí.
 */
export type VisualCiudad = {
  foto: string | null
  acento: string
  nombreAcento: string
  pos: { portada: string; franja: string; pase: string }
  velo: number
  veloMedio: number
}

export const ACENTO_POR_DEFECTO = '#f2b544'

const SIN_FOTO: VisualCiudad = {
  foto: null,
  acento: '#ede6da',
  nombreAcento: 'Hueso',
  pos: { portada: '50% 50%', franja: '50% 50%', pase: '50% 50%' },
  velo: 0,
  veloMedio: 0,
}

const CIUDADES: Record<string, VisualCiudad> = {
  bogota: {
    foto: bogota,
    acento: '#f2b544',
    nombreAcento: 'Ámbar farol',
    pos: { portada: '50% 40%', franja: '50% 52%', pase: '50% 35%' },
    velo: 0.35,
    veloMedio: 0.12,
  },
  medellin: {
    foto: medellin,
    acento: '#5cc08a',
    nombreAcento: 'Verde metro',
    pos: { portada: '58% 50%', franja: '60% 64%', pase: '60% 55%' },
    velo: 0.62,
    veloMedio: 0.38,
  },
  cali: {
    foto: cali,
    acento: '#f26b4d',
    nombreAcento: 'Coral bulevar',
    pos: { portada: '55% 50%', franja: '55% 42%', pase: '55% 45%' },
    velo: 0.62,
    veloMedio: 0.38,
  },
  cartagena: {
    foto: cartagena,
    acento: '#f2a99b',
    nombreAcento: 'Rosa catedral',
    pos: { portada: '42% 40%', franja: '45% 24%', pase: '42% 32%' },
    velo: 0.58,
    veloMedio: 0.32,
  },
  bucaramanga: {
    foto: bucaramanga,
    acento: '#f4d35e',
    nombreAcento: 'Amarillo Sagrada Familia',
    pos: { portada: '88% 50%', franja: '50% 55%', pase: '88% 50%' },
    velo: 0.5,
    veloMedio: 0.25,
  },
  tunja: {
    foto: tunja,
    acento: '#e3be86',
    nombreAcento: 'Arenisca',
    pos: { portada: '55% 50%', franja: '62% 45%', pase: '58% 50%' },
    velo: 0.55,
    veloMedio: 0.3,
  },
  villavicencio: {
    foto: villavicencio,
    acento: '#6cc6d9',
    nombreAcento: 'Turquesa de las letras',
    pos: { portada: '26% 50%', franja: '32% 55%', pase: '26% 50%' },
    velo: 0.55,
    veloMedio: 0.3,
  },
}

export function visualDe(ciudad: string | null | undefined): VisualCiudad {
  return CIUDADES[normalizar(ciudad ?? '')] ?? SIN_FOTO
}

export function ciudadesConFoto(): VisualCiudad[] {
  return Object.values(CIUDADES)
}

/** Gradiente del velo: oscuro arriba (título), limpio al centro, oscuro abajo (controles). */
export function veloFoto(v: VisualCiudad, fondoAbajo = 0.88): string {
  return `linear-gradient(180deg, rgba(13,20,17,${v.velo}) 0%, rgba(13,20,17,${v.veloMedio}) 24%, rgba(13,20,17,0) 44%, rgba(13,20,17,0) 52%, rgba(13,20,17,${fondoAbajo}) 78%, #0d1411 100%)`
}

/**
 * Tamaño del nombre de la ciudad en grande: nunca parte la palabra. Encoge según el largo del nombre
 * para que la palabra más larga quepa en el ancho de la pantalla (máx. 480 px) menos lo `ocupado`
 * (márgenes y botones al lado del título).
 */
export function tamanoTitulo(nombre: string, maximo: number, ocupado = 40): string {
  const larga = Math.max(4, ...nombre.split(/\s+/).map((p) => p.length))
  return `min(${maximo}px, calc((min(100vw, 480px) - ${ocupado}px) / ${(larga * 0.6).toFixed(2)}))`
}
