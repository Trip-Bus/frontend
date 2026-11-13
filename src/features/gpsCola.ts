import type { UbicacionConductorRequest } from '@/lib/tipos'

/** Cola en memoria para posiciones que no pudieron enviarse por falta de red. */
export class ColaGps {
  private posiciones: UbicacionConductorRequest[] = []
  private readonly capacidad: number

  constructor(capacidad = 50) {
    this.capacidad = capacidad
  }

  get cantidad(): number {
    return this.posiciones.length
  }

  agregar(posicion: UbicacionConductorRequest) {
    if (this.posiciones.length === this.capacidad) this.posiciones.shift()
    this.posiciones.push(posicion)
  }

  lote(): UbicacionConductorRequest[] {
    return [...this.posiciones]
  }

  confirmar(cantidad: number) {
    this.posiciones.splice(0, Math.max(0, Math.min(cantidad, this.posiciones.length)))
  }
}
