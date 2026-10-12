import type { ReactNode } from 'react'
import type { Item } from '../plan/schema'
import { TIME_ZONE, formatDateTime, formatDuration, formatRange } from '../lib/format'
import { gapsOf, itemCommits, itemTimes, segmentsOf } from '../plan/worklog'
import { useI18n } from '../i18n/i18n'
import { CloseIcon } from './Icons'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="console-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function ItemConsole({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t, lang } = useI18n()
  const none = <span className="console-muted">{t('console.none')}</span>
  const estimate = item.estimate_min ?? null
  // Inicio, fin y tiempo real se derivan de los tramos (D20).
  const times = itemTimes(item)
  const realMin = times?.realMin ?? null
  const over = estimate && realMin !== null ? realMin - estimate[1] : null
  const segments = segmentsOf(item)
  const commits = itemCommits(item)
  const pauses = gapsOf(segments.map((s) => [s.start, s.end]))
  const pauseMin = Math.round(pauses.reduce((sum, [a, b]) => sum + (b - a), 0) / 60_000)
  const clock = (ms: number) =>
    new Intl.DateTimeFormat(lang === 'es' ? 'es-EC' : 'en-US', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(ms)

  return (
    <section className="console" aria-live="polite">
      <header className="console-head">
        <span className="console-prompt">$ {t('console.command', { id: item.id })}</span>
        <button type="button" className="console-close" onClick={onClose} aria-label={t('console.close')}>
          <CloseIcon />
        </button>
      </header>
      <dl className="console-body">
        <Row label={t('console.title')}>{item.title}</Row>
        <Row label={t('console.type')}>{t(`type.${item.type}`)}</Row>
        <Row label={t('console.status')}>
          <span className={`console-status console-status--${item.status}`}>{t(`status.${item.status}`)}</span>
        </Row>
        <Row label={t('console.estimate')}>{estimate ? formatRange(estimate) : none}</Row>
        <Row label={t('console.real')}>
          {realMin !== null ? (
            <>
              {formatDuration(realMin)}
              {over !== null && (
                <span className={over > 0 ? 'console-over' : 'console-ok'}>
                  {'  '}
                  {over > 0 ? t('console.overBy', { duration: formatDuration(over) }) : t('console.withinEstimate')}
                </span>
              )}
            </>
          ) : (
            none
          )}
        </Row>
        <Row label={t('console.started')}>{times ? formatDateTime(times.start, lang) : none}</Row>
        <Row label={t('console.ended')}>{times ? formatDateTime(times.end, lang) : none}</Row>
        <Row label={t('console.worklog')}>
          {segments.length ? (
            <ul className="console-worklog">
              {segments.map((segment, i) => (
                <li key={i}>
                  <span className={`console-actor tl-actor--${segment.actor}`} />
                  {clock(segment.start)}–{clock(segment.end)} {t(`actor.${segment.actor}`)}
                  {segment.note && <span className="console-muted"> · {segment.note}</span>}
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </Row>
        {pauses.length > 0 && (
          <Row label={t('console.pauses')}>
            {pauses.length === 1
              ? t('console.pauseOne', { duration: formatDuration(pauseMin) })
              : t('console.pauseCount', { count: pauses.length, duration: formatDuration(pauseMin) })}
          </Row>
        )}
        <Row label={t('console.summary')}>{item.summary || none}</Row>
        <Row label={t('console.steps')}>
          {item.steps.length ? (
            <ol className="console-list">
              {item.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : (
            none
          )}
        </Row>
        <Row label={t('console.commits')}>
          {commits.length ? <span className="console-commits">{commits.join('  ')}</span> : none}
        </Row>
        <Row label={t('console.files')}>{item.files_changed}</Row>
        {item.notes && <Row label={t('console.notes')}>{item.notes}</Row>}
      </dl>
    </section>
  )
}
