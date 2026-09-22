import { analyze, rankedCompetitors } from '../lib/analytics'
import { formatDelta, formatLapTime } from '../lib/format'
import { isValidLap, type Competitor, type RaceSnapshot } from '../lib/protocol'

export function PaceChart({ snapshot, selectedId }: { snapshot: RaceSnapshot; selectedId: string | null }) {
  const drivers = rankedCompetitors(snapshot.competitors)
  const series = drivers.map((driver) => ({
    driver,
    points: Object.values(driver.lapsData)
      .filter(isValidLap)
      .sort((a, b) => a.lapNum - b.lapNum)
      .map((lap) => ({ x: lap.lapNum, y: lap.lapTime })),
  }))
  const allPoints = series.flatMap((s) => s.points)
  if (!allPoints.length) {
    return <div className="empty">Круги появятся после первого прохождения линии старт/финиш</div>
  }

  const minX = Math.min(...allPoints.map((p) => p.x))
  const maxX = Math.max(...allPoints.map((p) => p.x))
  const bestY = Math.min(...allPoints.map((p) => p.y))
  const y0 = bestY * 0.985
  const y1 = bestY * 1.22
  const w = 640
  const h = 200
  const left = 58
  const right = 16
  const top = 16
  const bottom = 28
  const xAt = (x: number) => left + ((x - minX) / Math.max(1, maxX - minX)) * (w - left - right)
  const yAt = (y: number) => top + (1 - (y - y0) / Math.max(1, y1 - y0)) * (h - top - bottom)

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'hidden' }}>
        {[0, 0.5, 1].map((t) => {
          const y = y0 + (y1 - y0) * t
          return (
            <g key={t}>
              <line x1={left} x2={w - right} y1={yAt(y)} y2={yAt(y)} stroke="rgba(255,255,255,0.08)" />
              <text x={4} y={yAt(y) + 4} fill="#8b93a3" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                {formatLapTime(y, 2)}
              </text>
            </g>
          )
        })}
        {series.map(({ driver, points }) => {
          if (points.length < 1) return null
          const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.x)},${yAt(p.y)}`).join(' ')
          const active = !selectedId || selectedId === driver.id
          return (
            <g key={driver.id} opacity={active ? 1 : 0.22}>
              <path d={d} fill="none" stroke={driver.color} strokeWidth={active ? 2.4 : 1.4} />
              {points.map((p) => (
                <circle key={`${driver.id}-${p.x}`} cx={xAt(p.x)} cy={yAt(p.y)} r={active ? 3 : 2} fill={driver.color} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="legend">
        {drivers.slice(0, 10).map((driver) => (
          <span key={driver.id}>
            <i style={{ background: driver.color }} />
            {driver.num} {driver.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DriverStats({ driver, snapshot }: { driver: Competitor | null; snapshot: RaceSnapshot }) {
  if (!driver) return <div className="empty">Выберите пилота в таблице, чтобы увидеть аналитику кругов</div>
  const stats = analyze(driver)
  const sessionBest = snapshot.run.bestLapTime
  const cards = [
    { label: 'Лучший круг', value: formatLapTime(stats.best), hint: sessionBest ? formatDelta(stats.best - sessionBest) : '' },
    { label: 'Средний', value: formatLapTime(stats.avg), hint: `σ ${formatLapTime(stats.stdev, 2)}` },
    { label: 'Теоретический', value: formatLapTime(stats.theoretical), hint: stats.best ? formatDelta(stats.theoretical - stats.best) : '' },
    { label: 'Стабильность', value: `${stats.consistency.toFixed(1)}%`, hint: `${stats.within102} кругов в 102%` },
    { label: 'Последние 3', value: formatLapTime(stats.rolling3), hint: stats.last ? `last ${formatLapTime(stats.last)}` : '' },
    { label: 'Разброс', value: formatLapTime(stats.spread), hint: `${stats.validLaps.length} валидных` },
  ]

  const maxSector = Math.max(stats.bestS1, stats.bestS2, stats.bestS3, snapshot.run.bestS1, snapshot.run.bestS2, snapshot.run.bestS3, 1)

  return (
    <>
      <div className="stats-grid">
        {cards.map((card) => (
          <div className="stat" key={card.label}>
            <span>{card.label}</span>
            <b className="mono">{card.value}</b>
            <div className="run-sub">{card.hint}</div>
          </div>
        ))}
      </div>
      <div className="sectors">
        {[
          ['S1', stats.bestS1, snapshot.run.bestS1],
          ['S2', stats.bestS2, snapshot.run.bestS2],
          ['S3', stats.bestS3, snapshot.run.bestS3],
        ].map(([label, best, session]) => (
          <div className="sector" key={String(label)}>
            <span>{label}</span>
            <b className="mono">{formatLapTime(Number(best), 2)}</b>
            <div className="run-sub">{session ? `best ${formatLapTime(Number(session), 2)}` : 'сектор'}</div>
            <div className="bar">
              <span style={{ width: `${(Number(best) / maxSector) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export function LapTable({ driver, snapshot }: { driver: Competitor | null; snapshot: RaceSnapshot }) {
  if (!driver) return null
  const stats = analyze(driver)
  const laps = Object.values(driver.lapsData).sort((a, b) => a.lapNum - b.lapNum || a.lapTs - b.lapTs)
  if (!laps.length) return <div className="empty">История кругов ещё не пришла</div>

  return (
    <div className="laps-wrap">
      <table>
        <thead>
          <tr>
            <th>Круг</th>
            <th>Поз</th>
            <th>Время</th>
            <th>Δ best</th>
            <th>S1</th>
            <th>S2</th>
            <th>S3</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => {
            const valid = isValidLap(lap)
            const isBest = valid && lap.lapTime === stats.best
            const isSessionBest = valid && lap.lapTime === snapshot.run.bestLapTime
            return (
              <tr key={lap.lapId}>
                <td className="mono">{lap.lapNum || 'out'}</td>
                <td className="mono">{lap.lapPos || '—'}</td>
                <td className={`mono ${isSessionBest ? 'purple' : isBest ? 'pb' : ''}`}>{formatLapTime(lap.lapTime)}</td>
                <td className="mono">{valid && stats.best ? formatDelta(lap.lapTime - stats.best) : ''}</td>
                <td className={`mono ${lap.sectors.s1 === stats.bestS1 ? 'pb' : ''}`}>{formatLapTime(lap.sectors.s1, 2)}</td>
                <td className={`mono ${lap.sectors.s2 === stats.bestS2 ? 'pb' : ''}`}>{formatLapTime(lap.sectors.s2, 2)}</td>
                <td className={`mono ${lap.sectors.s3 === stats.bestS3 ? 'pb' : ''}`}>{formatLapTime(lap.sectors.s3, 2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
