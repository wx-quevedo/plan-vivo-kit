import { useRef, type MouseEvent } from 'react'
import type { Phase } from '../plan/schema'
import { phaseEstimate, phaseProgress, phaseStatus } from '../plan/derive'
import { formatDuration, formatRange } from '../lib/format'
import { itemTimes, phaseRealMin } from '../plan/worklog'
import { useI18n } from '../i18n/i18n'
import { ArrowIcon, BackIcon, LockIcon } from './Icons'
import { ItemConsole } from './ItemConsole'

export interface ZoomOrigin {
  x: number
  y: number
}

interface Props {
  phases: Phase[]
  phaseId: string | null
  itemId: string | null
  origin: ZoomOrigin | null
  // Cambia en cada vuelta a la cuadrícula para repetir la animación de alejamiento.
  returnKey: number
  onOpen: (phaseId: string, origin: ZoomOrigin | null) => void
  onBack: () => void
  onSelectItem: (itemId: string | null) => void
}

function PhaseSummary({ phase }: { phase: Phase }) {
  const { t } = useI18n()
  const status = phaseStatus(phase)
  const progress = phaseProgress(phase)
  return (
    <>
      <div className="phase-status">
        <span className={`dot dot--${status}`} />
        {progress.total === 0
          ? `${t(`status.${status}`)} · ${t('phases.empty')}`
          : t('phases.summary', { status: t(`status.${status}`), done: progress.done, total: progress.total })}
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('phases.progress', { percent: progress.percent })}
      >
        <span className={`progress-fill progress-fill--${status}`} style={{ width: `${progress.percent}%` }} />
      </div>
    </>
  )
}

function PhaseGrid({ phases, onOpen, returnKey }: Pick<Props, 'phases' | 'onOpen' | 'returnKey'>) {
  const { t } = useI18n()
  const gridRef = useRef<HTMLDivElement>(null)

  function open(event: MouseEvent<HTMLButtonElement>, id: string) {
    const grid = gridRef.current?.getBoundingClientRect()
    const card = event.currentTarget.getBoundingClientRect()
    const origin = grid
      ? {
          x: ((card.left + card.width / 2 - grid.left) / grid.width) * 100,
          y: ((card.top + card.height / 2 - grid.top) / grid.height) * 100,
        }
      : null
    onOpen(id, origin)
  }

  return (
    <div ref={gridRef} key={returnKey} className={`phase-grid${returnKey > 0 ? ' phase-grid--return' : ''}`}>
      {phases.map((phase) => {
        const estimate = phaseEstimate(phase)
        const realMin = phaseRealMin(phase)
        return (
          <button
            key={phase.id}
            type="button"
            className={`phase-card phase-card--${phaseStatus(phase)}`}
            onClick={(event) => open(event, phase.id)}
            aria-label={t('phases.open', { id: phase.id, name: phase.name })}
          >
            <span className="phase-card-id">{phase.id}</span>
            <span className="phase-card-name">{phase.name}</span>
            <PhaseSummary phase={phase} />
            {estimate && <span className="phase-card-estimate">{t('phases.estimate', { range: formatRange(estimate) })}</span>}
            {realMin !== null && (
              <span className="phase-card-real" data-testid="fase-real">
                {t('phases.real', { duration: formatDuration(realMin) })}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function PhaseZoom({ phase, itemId, origin, onBack, onSelectItem }: { phase: Phase } & Pick<Props, 'itemId' | 'origin' | 'onBack' | 'onSelectItem'>) {
  const { t } = useI18n()
  const item = phase.items.find((candidate) => candidate.id === itemId) ?? null
  const transformOrigin = origin ? `${origin.x}% ${origin.y}%` : '50% 0%'

  return (
    <div className="zoom" key={phase.id} style={{ transformOrigin }}>
      <div className="zoom-head">
        <button type="button" className="back" onClick={onBack}>
          <BackIcon />
          {t('phases.back')}
        </button>
        <div className="zoom-title">
          <span className="phase-card-id">{phase.id}</span>
          <h3>{phase.name}</h3>
        </div>
        <div className="zoom-summary">
          <PhaseSummary phase={phase} />
        </div>
      </div>

      {phase.items.length === 0 ? (
        <p className="hint">{t('phases.noItems')}</p>
      ) : (
        <>
          <ol className="chain">
            {phase.items.map((node, index) => (
              <li key={node.id} className="chain-step">
                {index > 0 && <ArrowIcon />}
                <button
                  type="button"
                  className={`node node--${node.type} node--${node.status}${node.id === itemId ? ' node--selected' : ''}`}
                  onClick={() => onSelectItem(node.id === itemId ? null : node.id)}
                  aria-pressed={node.id === itemId}
                >
                  <span className="node-top">
                    <span className="node-id">{node.id}</span>
                    {node.type === 'gate' && <LockIcon />}
                    {node.type !== 'prompt' && <span className="node-type">{t(`type.${node.type}`)}</span>}
                  </span>
                  <span className="node-title">{node.title}</span>
                  <span className="node-status">
                    <span className={`dot dot--${node.status}`} />
                    {t(`status.${node.status}`)}
                  </span>
                  {node.estimate_min && (
                    <span className="node-estimate">
                      {itemTimes(node) ? `${formatDuration(itemTimes(node)!.realMin)} / ` : ''}
                      {formatRange(node.estimate_min)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
          {item ? <ItemConsole item={item} onClose={() => onSelectItem(null)} /> : <p className="hint">{t('phases.selectHint')}</p>}
        </>
      )}
    </div>
  )
}

export function PhasesView(props: Props) {
  const phase = props.phases.find((candidate) => candidate.id === props.phaseId)
  return (
    <div className="phases-stage">
      {phase ? (
        <PhaseZoom phase={phase} itemId={props.itemId} origin={props.origin} onBack={props.onBack} onSelectItem={props.onSelectItem} />
      ) : (
        <PhaseGrid phases={props.phases} onOpen={props.onOpen} returnKey={props.returnKey} />
      )}
    </div>
  )
}
