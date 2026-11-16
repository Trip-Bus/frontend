/** Descarga un objeto como archivo JSON en el navegador (sin pasar por el servidor). */
export function descargarJson(datos: unknown, nombre: string) {
  descargarTexto(JSON.stringify(datos, null, 2), nombre, 'application/json')
}

/** Descarga texto plano como archivo (p. ej. los códigos de recuperación). */
export function descargarTexto(texto: string, nombre: string, tipo = 'text/plain') {
  descargarBlob(new Blob([texto], { type: `${tipo};charset=utf-8` }), nombre)
}

/** Descarga un archivo binario recibido del servidor. */
export function descargarBlob(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
