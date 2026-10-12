import { STATUSES } from '../plan/schema'
import { useI18n } from '../i18n/i18n'
import { LockIcon } from './Icons'

export function Legend() {
  const { t } = useI18n()
  return (
    <section className="legend" aria-label={t('legend.title')}>
      {STATUSES.map((status) => (
        <span key={status} className="legend-chip">
          <span className={`dot dot--${status}`} />
          {t(`status.${status}`)}
        </span>
      ))}
      <span className="legend-chip">
        <span className="swatch swatch--unplanned" />
        {t('legend.unplanned')}
      </span>
      <span className="legend-chip">
        <span className="swatch swatch--gate">
          <LockIcon size={10} />
        </span>
        {t('legend.gate')}
      </span>
    </section>
  )
}
