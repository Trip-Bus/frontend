import { useQuery } from '@tanstack/react-query'
import { CreditCard, Landmark, Lock, Smartphone } from 'lucide-react'
import { Aviso } from '@/components/marca/Estados'
import { Segmentos, Selector } from '@/components/ui/campos'
import { Campo } from '@/components/ui/input'
import { textoError } from '@/lib/api'
import { api } from '@/lib/endpoints'
import { formatearNumero, formatearVence, marcaDe, NOMBRE_MARCA, soloDigitos, type ErroresTarjeta } from '@/lib/tarjeta'
import type { ErroresPse } from '@/features/pagos'
import type { DatosPse, MetodoPago, TipoDocumento } from '@/lib/tipos'

const METODOS: { valor: MetodoPago; texto: string }[] = [
  { valor: 'TARJETA', texto: 'Tarjeta' },
  { valor: 'PSE', texto: 'PSE' },
  { valor: 'NEQUI', texto: 'Nequi' },
]

export function SelectorMetodo({ valor, alCambiar }: { valor: MetodoPago; alCambiar: (m: MetodoPago) => void }) {
  return <Segmentos etiqueta="Medio de pago" opciones={METODOS} valor={valor} alCambiar={alCambiar} />
}

export type DatosTarjeta = { numero: string; vence: string; cvc: string }

export function FormTarjeta({
  datos,
  errores,
  alCambiar,
}: {
  datos: DatosTarjeta
  errores: ErroresTarjeta
  alCambiar: (parcial: Partial<DatosTarjeta>) => void
}) {
  const marca = marcaDe(datos.numero)
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <CreditCard className="size-5" aria-hidden="true" />
          Tarjeta de crédito o débito
        </span>
        {datos.numero && <span className="text-[13px] font-semibold text-texto-2">{NOMBRE_MARCA[marca]}</span>}
      </div>
      <Campo
        etiqueta="Número de tarjeta"
        inputMode="numeric"
        autoComplete="cc-number"
        enterKeyHint="next"
        placeholder="1234 5678 9012 3456"
        value={datos.numero}
        onChange={(e) => alCambiar({ numero: formatearNumero(e.target.value) })}
        error={errores.numero}
        className="num"
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          etiqueta="Vence"
          inputMode="numeric"
          autoComplete="cc-exp"
          enterKeyHint="next"
          placeholder="MM/AA"
          value={datos.vence}
          onChange={(e) => alCambiar({ vence: formatearVence(e.target.value) })}
          error={errores.vence}
          className="num"
        />
        <Campo
          etiqueta="CVC"
          inputMode="numeric"
          autoComplete="cc-csc"
          enterKeyHint="done"
          placeholder={marca === 'amex' ? '1234' : '123'}
          value={datos.cvc}
          onChange={(e) => alCambiar({ cvc: soloDigitos(e.target.value).slice(0, 4) })}
          error={errores.cvc}
          className="num"
        />
      </div>
      <p className="flex items-start gap-2 text-[13px] leading-snug text-texto-2">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        El número no sale de tu teléfono: solo enviamos un código de la pasarela y los últimos 4 dígitos.
      </p>
      <details className="text-[13px] text-texto-2">
        <summary className="cursor-pointer font-semibold">Tarjetas de prueba (sandbox)</summary>
        <ul className="mt-1.5 flex flex-col gap-1">
          <li>
            <span className="num">4242 4242 4242 4242</span>: aprobada
          </li>
          <li>
            <span className="num">4000 0000 0000 0002</span>: rechazada por fondos
          </li>
          <li>Cualquier fecha futura y CVC de 3 dígitos.</li>
        </ul>
      </details>
    </>
  )
}

const DOCUMENTOS_PSE: { valor: TipoDocumento; texto: string }[] = [
  { valor: 'CC', texto: 'Cédula de ciudadanía' },
  { valor: 'CE', texto: 'Cédula de extranjería' },
  { valor: 'NIT', texto: 'NIT' },
  { valor: 'PA', texto: 'Pasaporte' },
]

export function FormPse({ datos, errores, alCambiar }: { datos: DatosPse; errores: ErroresPse; alCambiar: (parcial: Partial<DatosPse>) => void }) {
  const bancos = useQuery({ queryKey: ['bancos-pse'], queryFn: api.reservas.bancosPse, staleTime: 10 * 60_000 })
  return (
    <>
      <span className="flex items-center gap-2 text-[15px] font-semibold">
        <Landmark className="size-5" aria-hidden="true" />
        Débito desde tu banco (PSE)
      </span>
      {bancos.isError && <Aviso tono="alerta">{textoError(bancos.error, 'No pudimos traer la lista de bancos.')}</Aviso>}
      <Selector
        etiqueta="Banco"
        vacia={bancos.isPending ? 'Cargando bancos…' : 'Elige tu banco'}
        value={datos.bancoCodigo}
        onChange={(e) => alCambiar({ bancoCodigo: e.target.value })}
        opciones={(bancos.data ?? []).map((b) => ({ valor: b.codigo, texto: b.nombre }))}
        aria-invalid={errores.bancoCodigo ? true : undefined}
      />
      {errores.bancoCodigo && (
        <span role="alert" className="-mt-2 text-[13px] font-medium text-presencia-borde">
          {errores.bancoCodigo}
        </span>
      )}
      <Segmentos
        etiqueta="Tipo de persona"
        opciones={[
          { valor: 'NATURAL', texto: 'Persona natural' },
          { valor: 'JURIDICA', texto: 'Empresa' },
        ]}
        valor={datos.tipoPersona}
        alCambiar={(tipoPersona) => alCambiar({ tipoPersona })}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
        <Selector
          etiqueta="Documento"
          value={datos.tipoDocumento}
          onChange={(e) => alCambiar({ tipoDocumento: e.target.value as TipoDocumento })}
          opciones={DOCUMENTOS_PSE}
        />
        <Campo
          etiqueta="Número"
          inputMode="numeric"
          autoComplete="off"
          value={datos.numeroDocumento}
          maxLength={20}
          onChange={(e) => alCambiar({ numeroDocumento: e.target.value.replace(/\s/g, '') })}
          error={errores.numeroDocumento}
        />
      </div>
      <p className="text-[13px] leading-snug text-texto-2">Te llevamos a la página de tu banco para aprobar el pago y luego vuelves aquí.</p>
      <details className="text-[13px] text-texto-2">
        <summary className="cursor-pointer font-semibold">Bancos de prueba (sandbox)</summary>
        <p className="mt-1.5">El banco 1 aprueba y el banco 2 rechaza.</p>
      </details>
    </>
  )
}

export function FormNequi({ telefono, error, alCambiar }: { telefono: string; error?: string; alCambiar: (t: string) => void }) {
  return (
    <>
      <span className="flex items-center gap-2 text-[15px] font-semibold">
        <Smartphone className="size-5" aria-hidden="true" />
        Nequi
      </span>
      <Campo
        etiqueta="Celular de tu cuenta Nequi"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="3001234567"
        value={telefono}
        maxLength={10}
        onChange={(e) => alCambiar(soloDigitos(e.target.value).slice(0, 10))}
        error={error}
        ayuda="Te llega una notificación a la app Nequi para aceptar el pago."
        className="num"
      />
      <details className="text-[13px] text-texto-2">
        <summary className="cursor-pointer font-semibold">Celulares de prueba (sandbox)</summary>
        <ul className="mt-1.5 flex flex-col gap-1">
          <li>
            <span className="num">3991111111</span>: aprueba
          </li>
          <li>
            <span className="num">3992222222</span>: rechaza
          </li>
        </ul>
      </details>
    </>
  )
}
