/**
 * Tono corto de alerta (SOS o accidente) con Web Audio: sin archivos de sonido. Si el navegador lo bloquea
 * (no hubo interacción todavía) simplemente no suena; la alerta igual se ve destacada.
 */
export function sonarAlerta() {
  try {
    const Contexto = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contexto) return
    const ctx = new Contexto()
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    vol.gain.value = 0.08
    osc.connect(vol)
    vol.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => void ctx.close().catch(() => undefined)
  } catch {
    /* sin audio disponible */
  }
}

/** Alertas de prioridad máxima: SOS del conductor y accidentes (o cualquier gravedad CRITICA). */
export function esAlertaMaxima(a: { tipo?: string | null; gravedad?: string | null }): boolean {
  return a.tipo === 'SOS' || a.tipo === 'ACCIDENTE' || a.gravedad === 'CRITICA'
}

/** Ordena primero lo más grave: SOS y accidentes, luego lo más reciente. */
export function ordenarAlertas<T extends { tipo?: string | null; gravedad?: string | null; creadoEn: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(esAlertaMaxima(b)) - Number(esAlertaMaxima(a)) || b.creadoEn.localeCompare(a.creadoEn))
}
