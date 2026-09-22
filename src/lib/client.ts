import {
  createCompetitor,
  cleanName,
  emptySnapshot,
  parseBinLaps,
  F,
  TRACK_ID,
  wsUrl,
  type Competitor,
  type JsonMap,
  type RaceSnapshot,
  type RunInfo,
} from './protocol'

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value)
}

function applyCompetitorFields(target: Competitor, data: JsonMap, now: number) {
  for (const [rawKey, value] of Object.entries(data)) {
    const key = Number(rawKey)
    switch (key) {
      case F.POS:
        target.pos = num(value)
        break
      case F.POS_CHANGE:
        target.posChange = num(value)
        break
      case F.NUM:
        target.num = cleanName(value)
        break
      case F.NAME:
        target.name = cleanName(value)
        break
      case F.COMPETITOR_STATE:
        target.state = num(value)
        break
      case F.BEST_LAP_TIME:
        target.bestLap = num(value)
        break
      case F.LAST_SECTOR_1:
        target.lastS1 = num(value)
        break
      case F.LAST_SECTOR_2:
        target.lastS2 = num(value)
        break
      case F.LAST_SECTOR_3:
        target.lastS3 = num(value)
        break
      case F.LAST_LAP_TIME_1:
        target.lastLap = num(value)
        break
      case F.LAST_LAP_TIME_2:
        target.lastLap2 = num(value)
        break
      case F.LAST_LAP_TIME_3:
        target.lastLap3 = num(value)
        break
      case F.LAPS_COUNT:
        target.laps = num(value)
        break
      case F.DIFF:
        target.diff = num(value)
        break
      case F.GAP:
        target.gap = num(value)
        break
      case F.BEST_SECTOR_1:
        target.bestS1 = num(value)
        break
      case F.BEST_SECTOR_2:
        target.bestS2 = num(value)
        break
      case F.BEST_SECTOR_3:
        target.bestS3 = num(value)
        break
      case F.COMBINED_BEST_LAP:
        target.theoretical = num(value)
        break
      case F.CAR_MODEL:
        target.kart = cleanName(value)
        break
      case F.TOTAL_TIME:
        target.totalTime = num(value)
        break
      case F.CAR_ID:
        target.carId = num(value)
        break
      case F.TEAM_NAME:
        target.team = cleanName(value)
        break
      case F.PITS_COUNT:
        target.pits = num(value)
        break
      case F.PIT_TIME:
        target.pitTime = num(value)
        break
      case F.SESSION_TIME:
        target.sessionTime = num(value)
        break
      case F.AVG_LAP_TIME:
        target.avgLap = num(value)
        break
      case F.CURRENT_LAP_TIME:
        target.currentLap = num(value)
        target.currentLapAt = now
        break
      case F.ADD_WEIGHT:
        target.weight = num(value)
        break
      default:
        break
    }
  }
}

function applyRunFields(run: RunInfo, data: JsonMap) {
  for (const [rawKey, value] of Object.entries(data)) {
    const key = Number(rawKey)
    switch (key) {
      case F.RUN_NAME:
        run.name = cleanName(value)
        break
      case F.RACE_NAME:
        run.raceName = cleanName(value)
        break
      case F.RACE_TIME:
        run.raceTime = num(value)
        break
      case F.TIME_TO_GO:
        run.timeToGo = num(value)
        break
      case F.TOTAL_LAPS:
        run.totalLaps = num(value)
        break
      case F.LAPS_TO_GO:
        run.lapsToGo = num(value)
        break
      case F.FLAG_STATUS:
        run.flag = num(value)
        break
      case F.FINISH_TYPE:
        run.finishType = str(value)
        break
      case F.RUN_QUEUE_GUID:
        run.guid = str(value)
        break
      case F.RUN_BEST_LAP_NAME:
        run.bestLapName = cleanName(value)
        break
      case F.RUN_BEST_LAP_TIME:
        run.bestLapTime = num(value)
        break
      case F.RUN_BEST_LAP_NUM:
        run.bestLapNum = str(value)
        break
      case F.RUN_BEST_LAP_CID:
        run.bestLapCid = str(value)
        break
      case F.RUN_BEST_SECTOR_1:
        run.bestS1 = num(value)
        break
      case F.RUN_BEST_SECTOR_2:
        run.bestS2 = num(value)
        break
      case F.RUN_BEST_SECTOR_3:
        run.bestS3 = num(value)
        break
      default:
        break
    }
  }
}

export class RaceClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<() => void>()
  private snapshot: RaceSnapshot = emptySnapshot('connecting')
  private competitors: Record<string, Competitor> = {}
  private run: RunInfo = emptySnapshot().run
  private raf = 0
  private closed = false
  private refs = 0

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  connect() {
    this.refs += 1
    this.closed = false
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.open()
  }

  disconnect() {
    this.refs = Math.max(0, this.refs - 1)
    if (this.refs > 0) return
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.setStatus('offline')
  }

  loadArchive(snapshot: RaceSnapshot) {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.competitors = snapshot.competitors
    this.run = snapshot.run
    this.snapshot = { ...snapshot, status: 'offline', source: 'archive', updatedAt: Date.now() }
    this.emit()
  }

  resumeLive() {
    this.competitors = {}
    this.run = emptySnapshot().run
    this.snapshot = emptySnapshot('connecting')
    this.emit()
    this.closed = false
    if (!this.ws || this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED) {
      this.open()
    }
  }

  private open() {
    if (this.closed) return
    this.setStatus('connecting')
    const ws = new WebSocket(wsUrl())
    this.ws = ws
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      ws.send(JSON.stringify({ trackId: TRACK_ID }))
      this.setStatus('live')
    }
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) this.handleBinary(event.data)
      else if (typeof event.data === 'string') {
        try {
          this.handleJson(JSON.parse(event.data) as JsonMap)
        } catch {
          /* ignore malformed frames */
        }
      }
    }
    ws.onclose = () => {
      if (this.closed) return
      this.setStatus('connecting')
      this.reconnectTimer = setTimeout(() => this.open(), 2000)
    }
    ws.onerror = () => ws.close()
  }

  private handleBinary(buffer: ArrayBuffer) {
    const head = new TextDecoder().decode(buffer.slice(0, 8))
    const offset = head === 'BINLAPS:' ? 8 : 0
    const grouped = parseBinLaps(buffer, offset)
    for (const [id, laps] of Object.entries(grouped)) {
      const driver = (this.competitors[id] ??= createCompetitor(id))
      const nextLaps = { ...driver.lapsData }
      for (const lap of laps) nextLaps[lap.lapId] = lap
      driver.lapsData = nextLaps
    }
    this.schedulePublish()
  }

  private handleJson(data: JsonMap) {
    if (data.command === 'clear' || data.race_command === 'reset_race') {
      this.competitors = {}
      this.run = { ...this.run, guid: this.run.guid }
      if (data.command === 'clear') {
        this.run = emptySnapshot().run
      }
    }

    applyRunFields(this.run, data)
    const now = Date.now()

    const results = data.results as Record<string, JsonMap> | undefined
    if (results) {
      for (const [id, fields] of Object.entries(results)) {
        const driver = (this.competitors[id] ??= createCompetitor(id))
        applyCompetitorFields(driver, fields, now)
      }
    }

    const sessions = data.sessions as Record<string, JsonMap> | undefined
    if (sessions) {
      for (const [id, fields] of Object.entries(sessions)) {
        const driver = this.competitors[id]
        if (driver) applyCompetitorFields(driver, fields, now)
      }
    }

    const removed = data.removeCompetitors as unknown[] | undefined
    if (removed) {
      for (const id of Object.values(removed)) delete this.competitors[String(id)]
    }

    const passings = data.passings as Record<string, JsonMap> | undefined
    if (passings) {
      for (const passing of Object.values(passings)) {
        const id = str(passing[String(F.PASSING_CID)])
        const driver = this.competitors[id]
        if (!driver) continue
        const kind = str(passing[String(F.PASSING_PASS_TYPE)])
        driver.flashKey = kind || 'LAP'
        driver.flashAt = now
        if (kind === 'LAP') driver.currentLapAt = now
      }
    }

    this.schedulePublish()
  }

  private setStatus(status: RaceSnapshot['status']) {
    if (this.snapshot.status === status && this.snapshot.source === 'live') return
    this.snapshot = { ...this.snapshot, status, source: 'live' }
    this.emit()
  }

  private schedulePublish() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.snapshot = {
        status: this.snapshot.status,
        source: 'live',
        run: { ...this.run },
        competitors: Object.fromEntries(
          Object.entries(this.competitors).map(([id, driver]) => [id, { ...driver }]),
        ),
        updatedAt: Date.now(),
      }
      this.emit()
    })
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export const raceClient = new RaceClient()
