/** Descarga un objeto como archivo JSON en el navegador (sin pasar por el servidor). */
export function descargarJson(datos: unknown, nombre: string) {
  descargarTexto(JSON.stringify(datos, null, 2), nombre, 'application/json')
}

/** Descarga texto plano como archivo (p. ej. los códigos de recuperación). */
export function descargarTexto(texto: string, nombre: string, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([texto], { type: `${tipo};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
