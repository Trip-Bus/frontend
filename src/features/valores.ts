/** Valores de un formulario de catálogo (Catalogo.tsx): texto o casilla por clave. */
export type Valores = Record<string, string | boolean>

/** Conversión de los valores del formulario a los tipos de la API. */
export const valor = {
  texto: (v: Valores, k: string) => String(v[k] ?? '').trim(),
  numero: (v: Valores, k: string) => (String(v[k] ?? '').trim() === '' ? null : Number(v[k])),
  opcional: (v: Valores, k: string) => String(v[k] ?? '').trim() || null,
}
