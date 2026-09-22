import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ArchivePanel } from './components/ArchivePanel'
import { DriverStats, LapTable, PaceChart } from './components/Analytics'
import { BonyLive } from './components/BonyLive'
import { SessionClock, Standings } from './components/Standings'
import { rankedCompetitors } from './lib/analytics'
import { raceClient } from './lib/client'
import { formatLapTime } from './lib/format'
import { SOURCE_URL } from './lib/protocol'

function isBonyLive(path: string) {
  return path === '/bony-live' || path === '/bony-live/'
}

function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return [path, setPath] as const
}

export default function App() {
  const snapshot = useSyncExternalStore(raceClient.subscribe, raceClient.getSnapshot, raceClient.getSnapshot)
  const [now, setNow] = useState(() => Date.now())
  const [path, setPath] = usePathname()
  const [tab, setTab] = useState<'live' | 'archive'>('live')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [archiveId, setArchiveId] = useState<string | null>(null)

  useEffect(() => {
    raceClient.connect()
    const tick = setInterval(() => setNow(Date.now()), 100)
    return () => {
      clearInterval(tick)
      raceClient.disconnect()
    }
  }, [])

  const ranked = useMemo(() => rankedCompetitors(snapshot.competitors), [snapshot])
  const selected = ranked.find((d) => d.id === selectedId) ?? ranked[0] ?? null

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  const status = snapshot.source === 'archive' ? 'offline' : snapshot.status
  const best = ranked[0]

  function openPath(event: { preventDefault: () => void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, next: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (window.location.pathname !== next) window.history.pushState(null, '', next)
    setPath(next)
    if (isBonyLive(next)) raceClient.resumeLive()
  }

  if (isBonyLive(path)) {
    return (
      <BonyLive snapshot={snapshot} onBack={(event) => openPath(event, '/')} />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="Гедуко" />
          <div>
            <h1>Geduko Analytics</h1>
            <p>
              Онлайн-разбор заезда · данные{' '}
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Kart Chrono
              </a>
            </p>
            <div className="top-actions">
              <div className={`status-pill ${status}`}>
                <b />
                {snapshot.source === 'archive'
                  ? 'архив'
                  : status === 'live'
                    ? 'live'
                    : status === 'connecting'
                      ? 'подключение'
                      : 'нет связи'}
              </div>
              <button
                className={`nav-btn ${tab === 'live' ? 'active' : ''}`}
                onClick={() => {
                  setTab('live')
                  setArchiveId(null)
                  raceClient.resumeLive()
                }}
              >
                Live
              </button>
              <button className={`nav-btn ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>
                Архив
              </button>
              <a className="nav-btn" href="/bony-live" onClick={(event) => openPath(event, '/bony-live')}>
                bony live
              </a>
            </div>
          </div>
        </div>
        <SessionClock snapshot={snapshot} />
      </header>

      <section className="kpis">
        <div className="kpi">
          <span>Лучший круг</span>
          <strong className="mono">{formatLapTime(snapshot.run.bestLapTime)}</strong>
          <em>{snapshot.run.bestLapName ? `${snapshot.run.bestLapNum} ${snapshot.run.bestLapName}` : 'ещё нет'}</em>
        </div>
        <div className="kpi">
          <span>Лидер</span>
          <strong>{best ? `${best.num} ${best.name}` : '—'}</strong>
          <em>{best ? `${best.laps} кругов` : 'ждем старт'}</em>
        </div>
        <div className="kpi">
          <span>На трассе</span>
          <strong className="mono">{ranked.length}</strong>
          <em>{snapshot.source === 'live' ? 'текущий заезд' : 'из архива'}</em>
        </div>
        <div className="kpi">
          <span>Выбран</span>
          <strong>{selected ? `${selected.num} ${selected.name}` : '—'}</strong>
          <em>{selected ? `теор. ${formatLapTime(selected.theoretical)}` : 'клик по строке'}</em>
        </div>
      </section>

      <main className="layout">
        <section className="panel">
          <div className="panel-h">{tab === 'archive' ? 'Архив заездов' : 'Текущий заезд'}</div>
          {tab === 'archive' ? (
            <>
              <ArchivePanel
                activeId={archiveId}
                onLoaded={(id) => {
                  setArchiveId(id)
                  setSelectedId(null)
                }}
              />
              {snapshot.source === 'archive' ? (
                <>
                  <div className="panel-h">Результаты заезда</div>
                  <Standings snapshot={snapshot} now={now} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
                </>
              ) : null}
            </>
          ) : (
            <Standings snapshot={snapshot} now={now} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          )}
        </section>

        <section className="right-stack">
          <div className="panel">
            <div className="panel-h">Аналитика · {selected ? selected.name : 'пилот не выбран'}</div>
            <DriverStats driver={selected} snapshot={snapshot} />
          </div>
          <div className="panel">
            <div className="panel-h">Темп по кругам</div>
            <PaceChart snapshot={snapshot} selectedId={selected?.id ?? null} />
          </div>
          <div className="panel">
            <div className="panel-h">Круги пилота</div>
            {tab === 'archive' && !archiveId ? (
              <div className="empty">Откройте заезд слева — таблица кругов появится здесь</div>
            ) : (
              <LapTable driver={selected} snapshot={snapshot} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
