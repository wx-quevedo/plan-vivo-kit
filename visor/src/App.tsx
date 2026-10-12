import { useRef, useState } from 'react'
import type { PlanResult } from './plan/schema'
import { TIME_ZONE, formatDateTime } from './lib/format'
import { nombreDeZona } from './lib/zona'
import { useI18n, type Lang } from './i18n/i18n'
import { useNow } from './hooks'
import { Legend } from './components/Legend'
import { PlanError } from './components/PlanError'
import { PhasesView, type ZoomOrigin } from './components/PhasesView'
import { TimelineView } from './components/TimelineView'
import { MetroMap } from './components/MetroMap'

const LANGS: Lang[] = ['es', 'en']

// El plan llega ya validado desde quien lo carga (main.tsx lo lee del servidor del visor).
export default function App({ planResult, path }: { planResult: PlanResult; path: string | null }) {
  const { t, lang, setLang } = useI18n()
  const now = useNow()
  const [phaseId, setPhaseId] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [origin, setOrigin] = useState<ZoomOrigin | null>(null)
  const [returnKey, setReturnKey] = useState(0)
  const phasesRef = useRef<HTMLElement>(null)

  if (!planResult.ok) return <PlanError issues={planResult.issues} />
  const plan = planResult.plan

  const openPhase = (id: string, from: ZoomOrigin | null = null) => {
    setOrigin(from)
    setPhaseId(id)
    setItemId(null)
  }
  // Desde la línea de tiempo o el mapa: sube a la vista de fases y hace zoom.
  const openFromBelow = (id: string) => {
    openPhase(id)
    phasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const back = () => {
    setPhaseId(null)
    setItemId(null)
    setReturnKey((k) => k + 1)
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1>{plan.title}</h1>
          <p className="top-sub">
            {t('app.subtitle')} · {t('app.updated', { date: formatDateTime(plan.updated_at, lang) })} · {t('app.timezone', { zone: nombreDeZona(TIME_ZONE) })}
          </p>
          {path && (
            <p className="top-file" data-testid="ruta-plan">
              {t('app.file', { path })}
            </p>
          )}
        </div>
        <div className="lang-switch" role="group" aria-label={t('app.language')}>
          {LANGS.map((code) => (
            <button key={code} type="button" aria-pressed={lang === code} onClick={() => setLang(code)}>
              {t(code === 'es' ? 'app.langEs' : 'app.langEn')}
            </button>
          ))}
        </div>
      </header>

      <Legend />

      <section ref={phasesRef} className="panel" id="fases">
        <h2>{t('phases.title')}</h2>
        <PhasesView
          phases={plan.phases}
          phaseId={phaseId}
          itemId={itemId}
          origin={origin}
          returnKey={returnKey}
          onOpen={openPhase}
          onBack={back}
          onSelectItem={setItemId}
        />
      </section>

      <section className="panel" id="linea-de-tiempo">
        <h2>{t('timeline.title')}</h2>
        <TimelineView plan={plan} now={now} onOpen={openFromBelow} />
      </section>

      <section className="panel" id="mapa">
        <h2>{t('map.title')}</h2>
        <MetroMap phases={plan.phases} onOpen={openFromBelow} />
      </section>
    </main>
  )
}
