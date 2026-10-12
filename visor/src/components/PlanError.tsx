import type { PlanIssue } from '../plan/schema'
import { formatIssue, useI18n } from '../i18n/i18n'

export function PlanError({ issues }: { issues: PlanIssue[] }) {
  const { t } = useI18n()
  return (
    <main className="page">
      <section className="plan-error" role="alert">
        <h1>{t('error.title')}</h1>
        <p>{t('error.intro')}</p>
        <p className="plan-error-count">{t(issues.length === 1 ? 'error.countOne' : 'error.countOther', { count: issues.length })}</p>
        <ul>
          {issues.map((issue, index) => (
            <li key={index}>
              <code>{formatIssue(issue, t)}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
