import { FLAG, STATE } from './protocol'

export function formatLapTime(ms: number, digits = 3): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const minutes = Math.floor(ms / 60_000)
  const seconds = (ms % 60_000) / 1000
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(digits).padStart(digits + 3, '0')}`
  }
  return seconds.toFixed(digits)
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function formatGap(ms: number): string {
  if (!ms) return ''
  if (ms <= -100_000) return `−${Math.round(-ms / 100_000)} сек.`
  if (ms < 0) {
    if (ms <= -10_000) return ''
    return `−${-ms} кр.`
  }
  return `+${formatLapTime(ms, 1)}`
}

export function formatDelta(ms: number): string {
  if (!Number.isFinite(ms) || ms === 0) return ''
  const sign = ms > 0 ? '+' : '−'
  return `${sign}${formatLapTime(Math.abs(ms), 3)}`
}

export function flagLabel(flag: number, finishType: string, running: boolean): {
  key: 'green' | 'red' | 'yellow' | 'finish' | 'idle'
  text: string
} {
  if (flag === FLAG.FINISH) return { key: 'finish', text: 'FINISH' }
  if (flag === FLAG.RED) return { key: 'red', text: 'RED FLAG' }
  if (flag === FLAG.WARMUP) return { key: 'yellow', text: 'WARMUP' }
  if (running) return { key: 'green', text: 'GREEN' }
  if (finishType) return { key: 'idle', text: 'READY' }
  return { key: 'idle', text: 'WAIT' }
}

export function stateLabel(state: number): string {
  if (state === STATE.FINISHED) return 'FIN'
  if (state === STATE.PIT_IN) return 'IN'
  if (state === STATE.PIT_OUT) return 'OUT'
  return ''
}

export function liveCurrentLap(baseMs: number, updatedAt: number, now: number, running: boolean): number {
  if (!running || baseMs <= 0 || !updatedAt) return baseMs
  return baseMs + Math.max(0, now - updatedAt)
}
