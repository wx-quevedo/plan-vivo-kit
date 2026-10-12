import { useState, type KeyboardEvent } from 'react'
import { ACTORS, type Plan } from '../plan/schema'
import { computeTimeline, type Span } from '../plan/timeline'
import { DAY_MS, formatDateTime, formatDuration, formatTick, timeTicks } from '../lib/format'
import { useI18n } from '../i18n/i18n'
import { useWidth } from '../hooks'

const ROW_H = 44
const TOP = 26
const AXIS_H = 30
const RIGHT = 18
// Banda de los tramos reales dentro de la fila; los carriles se reparten su alto.
const REAL_Y = 14
const REAL_H = 16

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`
}

export function TimelineView({ plan, now, onOpen }: { plan: Plan; now: number; onOpen: (phaseId: string) => void }) {
  const { t, lang } = useI18n()
  const [ref, width] = useWidth<HTMLDivElement>()
  const [scope, setScope] = useState<'plan' | 'real'>('plan')
  const timeline = computeTimeline(plan, now)
  const labelW = width < 560 ? 104 : 190
  const plotW = Math.max(40, width - labelW - RIGHT)
  const height = TOP + timeline.rows.length * ROW_H + AXIS_H
  // "Solo lo trabajado" acerca el eje a los tramos reales para que se vean las pausas y los huecos entre prompts.
  const segments = timeline.rows.flatMap((row) => row.segments)
  const realDomain: Span | null = segments.length
    ? [Math.min(...segments.map((s) => s.start)), Math.max(...segments.map((s) => s.end))]
    : null
  const domain: Span = scope === 'real' && realDomain ? realDomain : timeline.domain
  const [d0, d1] = domain
  const x = (value: number) => labelW + ((value - d0) / (d1 - d0)) * plotW
  // Una marca cada ~120 px para que las etiquetas no se encimen.
  const { ticks, step } = timeTicks(domain, Math.max(2, Math.floor(plotW / 120)))
  const withTime = step < DAY_MS
  const nowInDomain = now >= d0 && now <= d1
  const maxChars = Math.floor((labelW - 12) / 7.2)

  const span = (s: Span) => ({ x: x(s[0]), width: Math.max(3, x(s[1]) - x(s[0])) })
  const onKey = (event: KeyboardEvent, phaseId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(phaseId)
    }
  }

  let footer: string
  if (timeline.projectEnd === null) {
    footer = t('timeline.projectEndUnknown')
  } else {
    footer = t('timeline.projectEnd', {
      remaining: formatDuration(timeline.remainingMin),
      date: formatDateTime(timeline.projectEnd, lang),
    })
    if (timeline.unestimatedCount > 0) {
      footer += ` ${t(timeline.unestimatedCount === 1 ? 'timeline.unestimatedOne' : 'timeline.unestimatedMany', { count: timeline.unestimatedCount })}`
    }
  }
  const factorText = timeline.calibration
    ? t(timeline.calibration.items === 1 ? 'timeline.factorOne' : 'timeline.factor', {
        factor: new Intl.NumberFormat(lang === 'es' ? 'es-EC' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          timeline.calibration.factor,
        ),
        count: timeline.calibration.items,
      })
    : t('timeline.factorNone')

  return (
    <div className="timeline">
      {realDomain && (
        <div className="timeline-scope" role="group" aria-label={t('timeline.scopeLabel')}>
          {(['plan', 'real'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>
              {t(value === 'plan' ? 'timeline.scopePlan' : 'timeline.scopeReal')}
            </button>
          ))}
        </div>
      )}
      <div className="timeline-legend">
        <span className="legend-chip">
          <span className="bar-swatch bar-swatch--estimate" />
          {t('timeline.estimate')}
        </span>
        {ACTORS.map((actor) => (
          <span key={actor} className="legend-chip">
            <span className={`bar-swatch bar-swatch--actor tl-actor--${actor}`} />
            {t(`actor.${actor}`)}
          </span>
        ))}
        <span className="legend-chip">
          <span className="bar-swatch bar-swatch--projected" />
          {t('timeline.projected')}
        </span>
      </div>
      <div ref={ref} className="timeline-canvas">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={t('timeline.title')}>
            <defs>
              <clipPath id="tl-plot">
                <rect x={labelW} y={0} width={plotW} height={height} />
              </clipPath>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line className="tl-grid" x1={x(tick)} x2={x(tick)} y1={TOP - 6} y2={height - AXIS_H} />
                <text className="tl-tick" x={x(tick)} y={height - AXIS_H + 18} textAnchor={x(tick) > width - 50 ? 'end' : 'middle'}>
                  {formatTick(tick, lang, withTime)}
                </text>
              </g>
            ))}

            {timeline.rows.map((row, index) => {
              const y = TOP + index * ROW_H
              const laneH = REAL_H / row.lanes
              const projected = row.projected ? span(row.projected) : null
              // Etiqueta "proyectado": después de la barra si cabe; si no, dentro de ella; si no, antes.
              const labelPlace = !projected
                ? null
                : projected.x + projected.width + 90 < width
                  ? 'after'
                  : projected.width > 96
                    ? 'inside'
                    : 'before'
              return (
                <g
                  key={row.phaseId}
                  className="tl-row"
                  role="button"
                  tabIndex={0}
                  aria-label={t('timeline.rowLabel', { id: row.phaseId, name: row.name })}
                  onClick={() => onOpen(row.phaseId)}
                  onKeyDown={(event) => onKey(event, row.phaseId)}
                >
                  <rect className="tl-row-bg" x={0} y={y} width={width} height={ROW_H} />
                  <text className="tl-label" x={8} y={y + ROW_H / 2 + 4}>
                    <tspan className="tl-label-id">{row.phaseId}</tspan>
                    <tspan dx={6}>{truncate(row.name, Math.max(0, maxChars - row.phaseId.length - 1))}</tspan>
                  </text>
                  <g clipPath="url(#tl-plot)">
                  {row.estimate && <rect className={`tl-estimate tl--${row.status}`} y={y + 10} height={24} rx={4} {...span(row.estimate)} />}
                  {row.segments.map((segment, i) => (
                    <rect
                      key={`${segment.itemId}-${i}`}
                      className={`tl-segment tl-actor--${segment.actor}`}
                      y={y + REAL_Y + segment.lane * laneH}
                      height={Math.max(2, laneH - (row.lanes > 1 ? 1 : 0))}
                      rx={2}
                      {...span([segment.start, segment.end])}
                    >
                      <title>{`${segment.itemId} · ${t(`actor.${segment.actor}`)}${segment.note ? ` · ${segment.note}` : ''}`}</title>
                    </rect>
                  ))}
                  {row.waitGaps.map(([start, end]) => {
                    const gap = span([start, end])
                    return (
                      <g key={`espera-${start}`} className="tl-wait">
                        <title>{`${t('timeline.waiting')} · ${formatDuration(Math.round((end - start) / 60_000))}`}</title>
                        <rect x={gap.x} y={y + REAL_Y} width={gap.width} height={REAL_H} />
                      </g>
                    )
                  })}
                  {row.promptGaps.map(([start, end]) => {
                    const gap = span([start, end])
                    const label = `${t('timeline.betweenPrompts')} · ${formatDuration(Math.round((end - start) / 60_000))}`
                    // El hueco queda vacío; solo una línea punteada tenue lo marca. El texto aparece si cabe.
                    return (
                      <g key={start} className="tl-gap">
                        <title>{label}</title>
                        <line x1={gap.x} x2={gap.x + gap.width} y1={y + REAL_Y + REAL_H / 2} y2={y + REAL_Y + REAL_H / 2} />
                        {gap.width >= 64 && (
                          <text className="tl-gap-label" x={gap.x + gap.width / 2} y={y + 9} textAnchor="middle">
                            {t('timeline.betweenPrompts')}
                          </text>
                        )}
                      </g>
                    )
                  })}
                  {projected && (
                    <>
                      <rect className="tl-projected" y={y + 10} height={24} rx={4} {...projected} />
                      <text
                        className="tl-projected-label"
                        x={
                          labelPlace === 'after'
                            ? projected.x + projected.width + 6
                            : labelPlace === 'inside'
                              ? projected.x + 10
                              : projected.x - 6
                        }
                        y={y + ROW_H / 2 + 4}
                        textAnchor={labelPlace === 'before' ? 'end' : 'start'}
                      >
                        {t('timeline.projected')}
                      </text>
                    </>
                  )}
                  </g>
                  {row.unestimated && (
                    <text className="tl-unestimated" x={labelW + 4} y={y + ROW_H / 2 + 4}>
                      {t('timeline.unestimated')}
                    </text>
                  )}
                </g>
              )
            })}

            {nowInDomain && (
              <g className="tl-now">
                <line x1={x(now)} x2={x(now)} y1={TOP - 6} y2={height - AXIS_H} />
                <text x={x(now)} y={TOP - 10} textAnchor="middle">
                  {t('timeline.now')}
                </text>
              </g>
            )}
            <line className="tl-axis" x1={labelW} x2={labelW + plotW} y1={height - AXIS_H} y2={height - AXIS_H} />
          </svg>
        )}
      </div>
      <p className="timeline-footer">{footer}</p>
      <p className="timeline-factor">{factorText}</p>
    </div>
  )
}
