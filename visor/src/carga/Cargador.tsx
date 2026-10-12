import { useCallback, useEffect, useRef, useState } from 'react'
import App from '../App'
import { validatePlan, type PlanResult } from '../plan/schema'
import { useI18n } from '../i18n/i18n'

// Ruta de plan.json en disco, para los mensajes; la inyecta el servidor del visor.
const RUTA = typeof __PLAN_VIVO__ !== 'undefined' ? __PLAN_VIVO__.ruta : null

export type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; resultado: PlanResult }
  | { estado: 'no_existe' }
  | { estado: 'json_invalido'; detalle: string }
  | { estado: 'sin_servidor' }

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

export function Cargador() {
  const { t } = useI18n()
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  // Número del último pedido: si dos guardados llegan seguidos, una respuesta vieja no pisa a la nueva.
  const ultimo = useRef(0)

  const cargar = useCallback(async () => {
    const pedido = ++ultimo.current
    let nueva: Carga
    try {
      const respuesta = await fetch('/plan.json', { cache: 'no-store' })
      nueva = interpretar(respuesta.status, await respuesta.text())
    } catch {
      nueva = { estado: 'sin_servidor' }
    }
    if (pedido === ultimo.current) setCarga(nueva)
  }, [])

  useEffect(() => {
    void cargar()
    // El servidor avisa por el canal de Vite cada vez que plan.json cambia en disco.
    import.meta.hot?.on('plan-vivo:cambio', cargar)
    return () => import.meta.hot?.off('plan-vivo:cambio', cargar)
  }, [cargar])

  if (carga.estado === 'listo') return <App planResult={carga.resultado} path={RUTA} />
  if (carga.estado === 'cargando') return <main className="page"><p className="hint">{t('load.loading')}</p></main>

  const [titulo, texto] =
    carga.estado === 'no_existe'
      ? [t('load.notFoundTitle'), t('load.notFound', { path: RUTA ?? 'plan.json' })]
      : carga.estado === 'json_invalido'
        ? [t('load.invalidJsonTitle'), t('load.invalidJson', { path: RUTA ?? 'plan.json', detail: carga.detalle })]
        : [t('load.networkTitle'), t('load.network')]
  return (
    <main className="page">
      <section className="plan-error" role="alert" data-testid="error-carga">
        <h1>{titulo}</h1>
        <p>{texto}</p>
        <p className="plan-error-count">{t('load.retry')}</p>
      </section>
    </main>
  )
}
