import { useCallback, useEffect, useRef, useState } from 'react'
import App from '../App'
import { validatePlan, type PlanResult } from '../plan/schema'
import { useI18n } from '../i18n/i18n'

// Un plan de los que sirve el visor (GET /__plan-vivo/planes).
export interface PlanDelVisor {
  id: string
  ruta: string
}

export type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; resultado: PlanResult }
  | { estado: 'no_existe' }
  | { estado: 'json_invalido'; detalle: string }
  | { estado: 'sin_servidor' }
  | { estado: 'desconocido'; id: string }

// Interpreta la respuesta del servidor del visor (GET /plan.json): el texto del archivo tal cual, o 404.
export function interpretar(status: number, texto: string): Carga {
  if (status === 404) return { estado: 'no_existe' }
  if (status !== 200) return { estado: 'sin_servidor' }
  let crudo: unknown
  try {
    crudo = JSON.parse(texto)
  } catch (error) {
    return { estado: 'json_invalido', detalle: (error as Error).message }
  }
  return { estado: 'listo', resultado: validatePlan(crudo) }
}

// El plan que pide la dirección (?plan=<id>); sin id, el primero del visor. undefined si el id no está.
export function elegirPlan(planes: PlanDelVisor[], pedido: string | null): PlanDelVisor | undefined {
  return pedido ? planes.find((p) => p.id === pedido) : planes[0]
}

// Dirección de un plan: la raíz para el primero, ?plan=<id> para los demás.
export const enlace = (planes: PlanDelVisor[], plan: PlanDelVisor) => (planes[0]?.id === plan.id ? '/' : `/?plan=${encodeURIComponent(plan.id)}`)

function SelectorDePlanes({ planes, actual }: { planes: PlanDelVisor[]; actual: string | null }) {
  const { t } = useI18n()
  return (
    <nav className="plan-selector" aria-label={t('plans.label')} data-testid="selector-planes">
      <span className="plan-selector-label">{t('plans.label')}</span>
      {planes.map((plan) => (
        <a key={plan.id} href={enlace(planes, plan)} title={plan.ruta} aria-current={plan.id === actual ? 'page' : undefined}>
          {plan.id}
        </a>
      ))}
    </nav>
  )
}

export function Cargador() {
  const { t } = useI18n()
  const [planes, setPlanes] = useState<PlanDelVisor[] | null>(null)
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const pedido = new URLSearchParams(window.location.search).get('plan')
  const actual = planes ? elegirPlan(planes, pedido) : undefined
  // Número del último pedido: si dos guardados llegan seguidos, una respuesta vieja no pisa a la nueva.
  const ultimo = useRef(0)

  const cargarPlanes = useCallback(async () => {
    try {
      const respuesta = await fetch('/__plan-vivo/planes', { cache: 'no-store' })
      setPlanes(((await respuesta.json()) as { planes: PlanDelVisor[] }).planes)
    } catch {
      setCarga({ estado: 'sin_servidor' })
    }
  }, [])

  const cargar = useCallback(async (id: string) => {
    const numero = ++ultimo.current
    let nueva: Carga
    try {
      const respuesta = await fetch(`/plan.json?plan=${encodeURIComponent(id)}`, { cache: 'no-store' })
      nueva = interpretar(respuesta.status, await respuesta.text())
    } catch {
      nueva = { estado: 'sin_servidor' }
    }
    if (numero === ultimo.current) setCarga(nueva)
  }, [])

  useEffect(() => {
    void cargarPlanes()
    // El servidor avisa por el canal de Vite cuando se suma un plan al visor.
    const alSumar = () => void cargarPlanes()
    import.meta.hot?.on('plan-vivo:planes', alSumar)
    return () => import.meta.hot?.off('plan-vivo:planes', alSumar)
  }, [cargarPlanes])

  const id = actual?.id ?? null
  useEffect(() => {
    if (planes === null) return
    if (id === null) {
      setCarga(pedido ? { estado: 'desconocido', id: pedido } : { estado: 'no_existe' })
      return
    }
    void cargar(id)
    // Y cada vez que un plan cambia en disco: solo se recarga si es el que se está viendo.
    const alCambiar = (datos: { id?: string }) => {
      if (datos?.id === id) void cargar(id)
    }
    import.meta.hot?.on('plan-vivo:cambio', alCambiar)
    return () => import.meta.hot?.off('plan-vivo:cambio', alCambiar)
  }, [planes, id, pedido, cargar])

  const selector = planes && (planes.length > 1 || carga.estado === 'desconocido') ? <SelectorDePlanes planes={planes} actual={id} /> : null
  const ruta = actual?.ruta ?? null
  if (carga.estado === 'listo') {
    return (
      <>
        {selector}
        <App planResult={carga.resultado} path={ruta} />
      </>
    )
  }
  if (carga.estado === 'cargando') return <main className="page"><p className="hint">{t('load.loading')}</p></main>

  const [titulo, texto] =
    carga.estado === 'desconocido'
      ? [t('plans.unknownTitle'), t('plans.unknown', { id: carga.id })]
      : carga.estado === 'no_existe'
        ? [t('load.notFoundTitle'), t('load.notFound', { path: ruta ?? 'plan.json' })]
        : carga.estado === 'json_invalido'
          ? [t('load.invalidJsonTitle'), t('load.invalidJson', { path: ruta ?? 'plan.json', detail: carga.detalle })]
          : [t('load.networkTitle'), t('load.network')]
  return (
    <>
      {selector}
      <main className="page">
        <section className="plan-error" role="alert" data-testid="error-carga">
          <h1>{titulo}</h1>
          <p>{texto}</p>
          {carga.estado !== 'desconocido' && <p className="plan-error-count">{t('load.retry')}</p>}
        </section>
      </main>
    </>
  )
}
