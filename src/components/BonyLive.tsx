import { STATE, type Competitor, type RaceSnapshot } from '../lib/protocol'
import { flagLabel, formatClock, formatLapTime } from '../lib/format'
import { analyze, rankedCompetitors } from '../lib/analytics'

type Props = {
  snapshot: RaceSnapshot
  onBack: (event: { preventDefault: () => void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) => void
}

export function BonyLive({ snapshot, onBack }: Props) {
  const rows = rankedCompetitors(snapshot.competitors)
  const running = rows.some((driver) => driver.state && driver.state !== STATE.FINISHED)
  const flag = flagLabel(snapshot.run.flag, snapshot.run.finishType, running)
  const status = snapshot.status
  const clockMs =
    snapshot.run.finishType === 'finishByTime' || snapshot.run.timeToGo
      ? snapshot.run.timeToGo * 1000
      : snapshot.run.finishType === 'finishByLaps'
        ? null
        : snapshot.run.raceTime * 1000
  const clock =
    clockMs == null
      ? `${Math.max(0, snapshot.run.totalLaps - snapshot.run.lapsToGo)}/${snapshot.run.totalLaps || '—'}`
      : formatClock(clockMs)

  return (
    <div className="bony-page">
      <header className="bony-top">
        <a className="bony-back" href="/" onClick={onBack}>
          ← Live
        </a>
        <div className={`status-pill ${status}`}>
          <b />
          {status === 'live' ? 'live' : status === 'connecting' ? 'подключение' : 'нет связи'}
        </div>
      </header>

      <section className="bony-table">
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Пилот</th>
              <th>Темп заезда</th>
              <th>Темп 6 кр.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="bony-empty" colSpan={4}>
                  Ожидание заезда на трассе Гедуко…
                </td>
              </tr>
            ) : (
              paceRows(rows).map((row) => <BonyRow key={row.driver.id} row={row} />)
            )}
          </tbody>
        </table>
      </section>

      <div className="bony-summary">
        <div className="bony-hero">
          <p className="bony-kicker">bony live</p>
          <h1>{snapshot.run.name || 'Гедуко'}</h1>
          <div className="bony-clock mono">{clock}</div>
          <div className={`flag ${flag.key}`}>
            <i />
            {flag.text}
          </div>
        </div>

        <div className="bony-meta">
          <div>
            <span>Лучший</span>
            <strong className="mono">{formatLapTime(snapshot.run.bestLapTime)}</strong>
          </div>
          <div>
            <span>Пилот</span>
            <strong>{snapshot.run.bestLapName || '—'}</strong>
          </div>
          <div>
            <span>На трассе</span>
            <strong className="mono">{rows.length}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

type PaceRow = {
  driver: Competitor
  racePace: number
  recentPace: number
  raceRank: number
  recentRank: number
}

function BonyRow({ row }: { row: PaceRow }) {
  const { driver } = row
  return (
    <tr>
      <td className="num">{driver.num || '—'}</td>
      <td className="name">
        <b>{driver.name || 'Без имени'}</b>
        {driver.team ? <small>{driver.team}</small> : null}
      </td>
      <td className="mono">
        <span className={paceClass(row.raceRank, 'race')}>{formatLapTime(row.racePace)}</span>
      </td>
      <td className="mono">
        <span className={paceClass(row.recentRank, 'now')}>{formatLapTime(row.recentPace)}</span>
      </td>
    </tr>
  )
}

function paceRows(drivers: Competitor[]): PaceRow[] {
  const rows = drivers.map((driver) => {
    const times = analyze(driver).validLaps.map((lap) => lap.lapTime)
    const raceLaps = times.filter((time) => time <= 120_000)
    const racePace = raceLaps.length ? Math.round(mean(raceLaps)) : 0
    const recentPace = times.length >= 6 ? Math.round(mean(withoutWorst(times.slice(-6), 2))) : 0
    return { driver, racePace, recentPace, raceRank: 0, recentRank: 0 }
  })
  const raceValues = rows.map((row) => row.racePace)
  const recentValues = rows.map((row) => row.recentPace)
  return rows.map((row) => ({
    ...row,
    raceRank: paceRank(row.racePace, raceValues),
    recentRank: paceRank(row.recentPace, recentValues),
  }))
}

function paceRank(value: number, values: number[]) {
  if (value <= 0) return 0
  const ahead = new Set(values.filter((item) => item > 0 && item < value)).size
  const rank = ahead + 1
  return rank <= 3 ? rank : 0
}

function paceClass(rank: number, kind: 'race' | 'now') {
  if (rank === 1) return kind === 'race' ? 'pace pace-race' : 'pace pace-now'
  if (rank === 2) return 'pace pace-2'
  if (rank === 3) return 'pace pace-3'
  return ''
}

function withoutWorst(times: number[], drop: number) {
  return [...times].sort((a, b) => a - b).slice(0, Math.max(0, times.length - drop))
}

function mean(times: number[]) {
  return times.reduce((sum, time) => sum + time, 0) / times.length
}
