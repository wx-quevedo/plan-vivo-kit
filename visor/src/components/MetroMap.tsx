import type { Phase } from '../plan/schema'
import { currentPhaseId, phaseStatus } from '../plan/derive'
import { useI18n } from '../i18n/i18n'

// Las columnas se reparten el ancho disponible (minmax(0, 1fr)) para que las estaciones quepan sin
// desplazamiento horizontal; en pantallas angostas el CSS oculta el nombre y deja solo el id.
export function MetroMap({ phases, onOpen }: { phases: Phase[]; onOpen: (phaseId: string) => void }) {
  const { t } = useI18n()
  const hereId = currentPhaseId(phases)
  const lastIndex = phases.length - 1

  return (
    <ol className="metro" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
      {phases.map((phase, index) => {
        const status = phaseStatus(phase)
        const isHere = phase.id === hereId
        const next = phases[index + 1]
        // La píldora se ancla al borde en las estaciones de los extremos para no salirse del panel.
        const edge = index === 0 ? ' metro-stop--first' : index === lastIndex ? ' metro-stop--last' : ''
        return (
          <li key={phase.id} className={`metro-stop${edge}`}>
            <span className={`metro-here${isHere ? ' metro-here--active' : ''}`} aria-hidden={!isHere}>
              {isHere && <span className="metro-here-pill">{t('map.here')}</span>}
            </span>
            <span className="metro-track">
              {index > 0 && <span className={`metro-line metro-line--left${status === 'pending' ? '' : ' metro-line--active'}`} />}
              {next && <span className={`metro-line metro-line--right${phaseStatus(next) === 'pending' ? '' : ' metro-line--active'}`} />}
              <button
                type="button"
                className={`metro-station metro-station--${status}${isHere ? ' metro-station--here' : ''}`}
                onClick={() => onOpen(phase.id)}
                aria-label={t('map.station', { id: phase.id, name: phase.name })}
                title={`${phase.id} · ${phase.name} · ${t(`status.${status}`)}`}
              />
            </span>
            <span className="metro-label" title={`${phase.id} · ${phase.name}`}>
              <strong>{phase.id}</strong>
              <span className="metro-name">{phase.name}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
