import { useEffect, useState } from 'react'
import { fetchArchiveList, fetchArchiveRun, type ArchiveRun } from '../lib/archive'
import { raceClient } from '../lib/client'
import type { RaceSnapshot } from '../lib/protocol'

export function ArchivePanel({
  activeId,
  onLoaded,
}: {
  activeId: string | null
  onLoaded: (runId: string, snapshot: RaceSnapshot) => void
}) {
  const [runs, setRuns] = useState<ArchiveRun[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchArchiveList()
      .then((list) => {
        if (!cancelled) setRuns(list)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function openRun(run: ArchiveRun) {
    setError('')
    try {
      const snapshot = await fetchArchiveRun(run.id, run)
      raceClient.loadArchive(snapshot)
      onLoaded(run.id, snapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    }
  }

  return (
    <div className="archive-list">
      {loading ? <div className="empty">Загрузка архива Гедуко…</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {runs.map((run) => (
        <button
          key={run.id}
          className={`archive-item ${activeId === run.id ? 'active' : ''}`}
          onClick={() => void openRun(run)}
        >
          <b className="mono">{run.time}</b>
          <span>
            <strong>{run.name}</strong>
            <small className="run-sub" style={{ display: 'block' }}>
              {run.date} · {run.config}
            </small>
          </span>
          <span className="run-sub">{run.racers} уч.</span>
        </button>
      ))}
    </div>
  )
}
