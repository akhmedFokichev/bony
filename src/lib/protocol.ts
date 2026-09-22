export const TRACK_ID = '2109229b622d90608882c752782d56b2'
export const SOURCE_URL = 'https://geduko.kartchrono.com/'

export function wsUrl(): string {
  if (typeof location === 'undefined') return 'ws://localhost:5173/kc-ws'
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/kc-ws`
}

export const F = {
  POS: 1,
  POS_CHANGE: 2,
  NUM: 3,
  NAME: 4,
  COMPETITOR_STATE: 5,
  BEST_LAP_TIME: 6,
  LAST_SECTOR_1: 7,
  LAST_SECTOR_2: 8,
  LAST_SECTOR_3: 9,
  LAST_LAP_TIME_1: 10,
  LAST_LAP_TIME_2: 11,
  LAST_LAP_TIME_3: 12,
  LAPS_COUNT: 13,
  DIFF: 14,
  GAP: 15,
  BEST_SECTOR_1: 16,
  BEST_SECTOR_2: 17,
  BEST_SECTOR_3: 18,
  COMBINED_BEST_LAP: 19,
  CAR_MODEL: 21,
  TOTAL_TIME: 23,
  CAR_ID: 25,
  TEAM_NAME: 26,
  PITS_COUNT: 27,
  PIT_TIME: 28,
  SESSION_TIME: 29,
  AVG_LAP_TIME: 32,
  CURRENT_LAP_TIME: 44,
  TRANSPONDER_ID: 50,
  ADD_WEIGHT: 63,
  RACE_TIME: 100,
  TIME_TO_GO: 101,
  TOTAL_LAPS: 102,
  LAPS_TO_GO: 103,
  RUN_NAME: 104,
  RACE_NAME: 105,
  FLAG_STATUS: 106,
  SORT_MODE: 107,
  FINISH_TYPE: 108,
  RUN_QUEUE_GUID: 111,
  RUN_BEST_LAP_NAME: 200,
  RUN_BEST_LAP_TIME: 201,
  RUN_BEST_LAP_NUM: 202,
  RUN_BEST_LAP_CID: 203,
  RUN_BEST_SECTOR_1: 204,
  RUN_BEST_SECTOR_2: 205,
  RUN_BEST_SECTOR_3: 206,
  PASSING_CID: 300,
  PASSING_LAP_TIME: 301,
  PASSING_PASS_TYPE: 302,
} as const

export const FLAG = {
  FINISH: 3,
  RED: 2,
  WARMUP: 4,
} as const

export const STATE = {
  RUNNING: 2,
  FINISHED: 5,
  PIT_IN: 6,
  PIT_OUT: 7,
} as const

export const LAP_FLAG = {
  WARMUP: 1,
  GREEN: 2,
  YELLOW: 4,
  RED: 8,
  FINISH: 16,
  BEST_LAP: 32,
  BEST_S1: 64,
  BEST_S2: 128,
  BEST_S3: 256,
  TOTAL_BEST: 4096,
  TOTAL_S1: 8192,
  TOTAL_S2: 16384,
  TOTAL_S3: 32768,
  DELETED: 1_048_576,
  REJECTED: 2_097_152,
  PITIN: 4_194_304,
  PITOUT: 8_388_608,
} as const

export const DRIVER_COLORS = [
  '#ff6a1a',
  '#3dff8a',
  '#5b8cff',
  '#e8d44d',
  '#ff5bd0',
  '#00d4c8',
  '#ff4d4d',
  '#c084fc',
  '#9ae66e',
  '#7dd3fc',
]

export type JsonMap = Record<string, unknown>

export type Lap = {
  lapId: number
  lapNum: number
  raceLapNum: number
  lapPos: number
  sectors: { s1: number; s2: number; s3: number; s4: number }
  lapTime: number
  lapTs: number
  lapFlags: number
}

export type Competitor = {
  id: string
  pos: number
  posChange: number
  num: string
  name: string
  state: number
  bestLap: number
  lastS1: number
  lastS2: number
  lastS3: number
  lastLap: number
  lastLap2: number
  lastLap3: number
  laps: number
  diff: number
  gap: number
  bestS1: number
  bestS2: number
  bestS3: number
  theoretical: number
  kart: string
  totalTime: number
  carId: number
  team: string
  pits: number
  pitTime: number
  sessionTime: number
  avgLap: number
  currentLap: number
  currentLapAt: number
  weight: number
  color: string
  flashKey: string
  flashAt: number
  lapsData: Record<number, Lap>
}

export type RunInfo = {
  name: string
  raceName: string
  raceTime: number
  timeToGo: number
  totalLaps: number
  lapsToGo: number
  flag: number
  finishType: string
  guid: string
  bestLapName: string
  bestLapTime: number
  bestLapNum: string
  bestLapCid: string
  bestS1: number
  bestS2: number
  bestS3: number
}

export type ConnectionStatus = 'connecting' | 'live' | 'offline'

export type RaceSnapshot = {
  status: ConnectionStatus
  source: 'live' | 'archive'
  run: RunInfo
  competitors: Record<string, Competitor>
  updatedAt: number
}

export function emptyRun(): RunInfo {
  return {
    name: '',
    raceName: '',
    raceTime: 0,
    timeToGo: 0,
    totalLaps: 0,
    lapsToGo: 0,
    flag: 0,
    finishType: '',
    guid: '',
    bestLapName: '',
    bestLapTime: 0,
    bestLapNum: '',
    bestLapCid: '',
    bestS1: 0,
    bestS2: 0,
    bestS3: 0,
  }
}

export function emptySnapshot(status: ConnectionStatus = 'connecting'): RaceSnapshot {
  return {
    status,
    source: 'live',
    run: emptyRun(),
    competitors: {},
    updatedAt: 0,
  }
}

export function cleanName(value: unknown): string {
  return String(value ?? '')
    .replace(/\0/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function colorForId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return DRIVER_COLORS[Math.abs(hash) % DRIVER_COLORS.length]
}

export function createCompetitor(id: string): Competitor {
  return {
    id,
    pos: 0,
    posChange: 0,
    num: '',
    name: '',
    state: 0,
    bestLap: 0,
    lastS1: 0,
    lastS2: 0,
    lastS3: 0,
    lastLap: 0,
    lastLap2: 0,
    lastLap3: 0,
    laps: 0,
    diff: 0,
    gap: 0,
    bestS1: 0,
    bestS2: 0,
    bestS3: 0,
    theoretical: 0,
    kart: '',
    totalTime: 0,
    carId: 0,
    team: '',
    pits: 0,
    pitTime: 0,
    sessionTime: 0,
    avgLap: 0,
    currentLap: 0,
    currentLapAt: 0,
    weight: 0,
    color: colorForId(id),
    flashKey: '',
    flashAt: 0,
    lapsData: {},
  }
}

export function isValidLap(lap: Lap): boolean {
  if (lap.lapTime <= 0) return false
  const skip =
    LAP_FLAG.DELETED |
    LAP_FLAG.REJECTED |
    LAP_FLAG.PITIN |
    LAP_FLAG.PITOUT
  if (lap.lapFlags & skip) return false
  return lap.lapNum > 0
}

export function parseBinLaps(buffer: ArrayBuffer, offset = 0): Record<string, Lap[]> {
  const view = new DataView(buffer)
  const grouped: Record<string, Lap[]> = {}
  for (let i = offset; i + 52 <= view.byteLength; i += 52) {
    const competitorId = String(view.getInt32(i, true))
    const tsLo = view.getUint32(i + 36, true)
    const tsHi = view.getUint32(i + 40, true)
    const lap: Lap = {
      lapId: view.getInt32(i + 4, true),
      lapNum: view.getInt32(i + 8, true),
      raceLapNum: view.getInt32(i + 12, true),
      lapPos: view.getInt32(i + 16, true),
      sectors: {
        s1: view.getInt32(i + 20, true),
        s2: view.getInt32(i + 24, true),
        s3: view.getInt32(i + 28, true),
        s4: view.getInt32(i + 48, true),
      },
      lapTime: view.getInt32(i + 32, true),
      lapTs: tsLo + 4294967296 * tsHi,
      lapFlags: view.getInt32(i + 44, true),
    }
    ;(grouped[competitorId] ??= []).push(lap)
  }
  return grouped
}

export function decodeBase64Laps(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
