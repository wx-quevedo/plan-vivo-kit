// Desfase de una zona horaria IANA en un instante, en minutos (por ejemplo -300 para America/Guayaquil).
// Sirve también para zonas con horario de verano: el desfase se calcula para cada instante.
export function desfaseMin(ms: number, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ms)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === tipo)?.value)
  const local = Date.UTC(valor('year'), valor('month') - 1, valor('day'), valor('hour'), valor('minute'), valor('second'))
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000)
}

const dos = (n: number) => String(n).padStart(2, '0')

// Fecha ISO 8601 en la hora local de la zona, con su desfase y precisión de segundos: 2026-10-09T14:12:00-05:00.
export function aLocal(ms: number, zona: string): string {
  const desfase = desfaseMin(ms, zona)
  const signo = desfase < 0 ? '-' : '+'
  const abs = Math.abs(desfase)
  return `${new Date(ms + desfase * 60_000).toISOString().slice(0, 19)}${signo}${dos(Math.floor(abs / 60))}:${dos(abs % 60)}`
}

// Nombre corto para mostrar: "America/Guayaquil" se muestra como "Guayaquil".
export function nombreDeZona(zona: string): string {
  return (zona.split('/').pop() ?? zona).replace(/_/g, ' ')
}
