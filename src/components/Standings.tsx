import { FLAG, STATE, type Competitor, type RaceSnapshot } from '../lib/protocol'
import { flagLabel, formatClock, formatGap, formatLapTime, liveCurrentLap, stateLabel } from '../lib/format'
import { rankedCompetitors } from '../lib/analytics'

type Props = {
  snapshot: RaceSnapshot
  now: number
  selectedId: string | null
  onSelect: (id: string) => void
}

export function Standings({ snapshot, now, selectedId, onSelect }: Props) {
  const rows = rankedCompetitors(snapshot.competitors)
  const bestId = snapshot.run.bestLapCid

  if (!rows.length) {
    return (
      <div className="empty">
        {snapshot.source === 'live' ? 'Ожидание заезда на трассе Гедуко…' : 'В этом заезде нет кругов'}
      </div>
    )
  }

  return (
    <div className="standings">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>№</th>
            <th>Пилот</th>
            <th>Лучший</th>
            <th>Последний</th>
            <th>Круг</th>
            <th>Отст.</th>
            <th>S1</th>
            <th>S2</th>
            <th>S3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((driver) => (
            <StandingRow
              key={driver.id}
              driver={driver}
              now={now}
              selected={driver.id === selectedId}
              overallBest={driver.id === bestId}
              onSelect={onSelect}
              snapshot={snapshot}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StandingRow({
  driver,
  now,
  selected,
  overallBest,
  onSelect,
  snapshot,
}: {
  driver: Competitor
  now: number
  selected: boolean
  overallBest: boolean
  onSelect: (id: string) => void
  snapshot: RaceSnapshot
}) {
  const running =
    driver.state !== STATE.FINISHED &&
    driver.state !== STATE.PIT_IN &&
    snapshot.run.flag !== FLAG.FINISH
  const current = liveCurrentLap(driver.currentLap, driver.currentLapAt, now, running)
  const lastIsBest = driver.lastLap > 0 && driver.lastLap === driver.bestLap
  const flash = now - driver.flashAt < 900

  return (
    <tr className={`clickable ${selected ? 'selected' : ''}`} onClick={() => onSelect(driver.id)}>
      <td>
        <span className={`pos ${driver.pos === 1 ? 'p1' : driver.pos === 2 ? 'p2' : driver.pos === 3 ? 'p3' : ''}`}>
          {driver.pos || '—'}
        </span>
      </td>
      <td className="num">{driver.num || '—'}</td>
      <td className="name">
        {driver.name || 'Без имени'}
        <small>
          {driver.kart || driver.team || 'карт'}
          {stateLabel(driver.state) ? ` · ${stateLabel(driver.state)}` : ''}
        </small>
      </td>
      <td className={`mono best ${overallBest ? 'purple' : ''}`}>{formatLapTime(driver.bestLap)}</td>
      <td className={`mono ${lastIsBest ? 'pb' : ''} ${flash && driver.flashKey === 'LAP' ? 'flash' : ''}`}>
        {formatLapTime(driver.lastLap)}
      </td>
      <td className="mono">
        {driver.laps}
        {current > 0 && running ? ` · ${formatLapTime(current, 1)}` : ''}
      </td>
      <td className="mono">{formatGap(driver.diff)}</td>
      <td className={`mono ${flash && driver.flashKey === 'S1' ? 'flash pb' : ''}`}>{formatLapTime(driver.lastS1, 2)}</td>
      <td className={`mono ${flash && driver.flashKey === 'S2' ? 'flash pb' : ''}`}>{formatLapTime(driver.lastS2, 2)}</td>
      <td className={`mono ${flash && driver.flashKey === 'S3' ? 'flash pb' : ''}`}>{formatLapTime(driver.lastS3, 2)}</td>
    </tr>
  )
}

export function SessionClock({ snapshot }: { snapshot: RaceSnapshot }) {
  const running = Object.values(snapshot.competitors).some((d) => d.state && d.state !== STATE.FINISHED)
  const flag = flagLabel(snapshot.run.flag, snapshot.run.finishType, running)
  const clockMs =
    snapshot.run.finishType === 'finishByTime' || snapshot.run.timeToGo
      ? snapshot.run.timeToGo * 1000
      : snapshot.run.finishType === 'finishByLaps'
        ? null
        : snapshot.run.raceTime * 1000
  const clock =
    clockMs == null
      ? `${snapshot.run.totalLaps - snapshot.run.lapsToGo}/${snapshot.run.totalLaps}`
      : formatClock(clockMs)
  const clockParts = clock.split(':')

  return (
    <div className="run-center">
      <p className="run-title">{snapshot.run.name || 'Гедуко картинг'}</p>
      <div className={`clock mono ${snapshot.run.flag === FLAG.FINISH ? 'purple' : ''}`}>
        {clockParts.map((part, i) => (
          <span key={`${part}-${i}`}>
            {i > 0 ? <span className="clock-colon">:</span> : null}
            {part}
          </span>
        ))}
      </div>
      <div className={`flag ${flag.key}`}>
        <i />
        {flag.text}
      </div>
      {snapshot.run.raceName ? <div className="run-sub">{snapshot.run.raceName}</div> : null}
    </div>
  )
}
