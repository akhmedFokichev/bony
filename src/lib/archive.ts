import {
  cleanName,
  createCompetitor,
  decodeBase64Laps,
  emptyRun,
  isValidLap,
  parseBinLaps,
  type Competitor,
  type RaceSnapshot,
} from './protocol'

export type ArchiveRun = {
  id: string
  name: string
  config: string
  time: string
  date: string
  racers: number
}

function parseCount(text: string): number {
  const match = text.replace(/\s+/g, ' ').match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

export async function fetchArchiveList(): Promise<ArchiveRun[]> {
  const res = await fetch('/kc/archive/')
  if (!res.ok) throw new Error('Не удалось загрузить архив')
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const runs: ArchiveRun[] = []
  let date = ''
  for (const node of doc.querySelectorAll('.archiveDateHeader, .archiveDataRow')) {
    if (node.classList.contains('archiveDateHeader')) {
      date = node.textContent?.trim() ?? ''
      continue
    }
    const link = node.querySelector('a')
    const href = link?.getAttribute('href') ?? ''
    const id = new URLSearchParams(href.replace(/^\?/, '')).get('runId')
    if (!id) continue
    runs.push({
      id,
      name: node.querySelector('#archiveRunName > div')?.textContent?.trim() || `Заезд ${id}`,
      config: node.querySelector('.trackConfigName')?.textContent?.trim() || '',
      time: node.querySelector('#archiveRunStart')?.textContent?.trim() || '',
      date,
      racers: parseCount(node.querySelector('#archiveRunRacersCount')?.textContent ?? ''),
    })
  }
  return runs
}

type ArchiveCompetitorJson = {
  num?: string
  name?: string
  laps?: number
  total_time?: number
  theor_lap?: number
  pos?: number
  kart?: string
  team?: string
  binary_laps?: string
}

export async function fetchArchiveRun(runId: string, meta?: ArchiveRun): Promise<RaceSnapshot> {
  const res = await fetch(`/kc/archive/?runId=${encodeURIComponent(runId)}`)
  if (!res.ok) throw new Error('Не удалось загрузить заезд')
  const html = await res.text()
  const raw = extractJsCompetitors(html)
  if (!raw) throw new Error('В архиве нет данных кругов')
  const competitors: Record<string, Competitor> = {}

  for (const [id, info] of Object.entries(raw)) {
    const driver = createCompetitor(id)
    driver.num = cleanName(info.num)
    driver.name = cleanName(info.name)
    driver.laps = Number(info.laps) || 0
    driver.totalTime = Number(info.total_time) || 0
    driver.theoretical = Number(info.theor_lap) || 0
    driver.pos = Number(info.pos) || 0
    driver.kart = cleanName(info.kart)
    driver.team = cleanName(info.team)
    if (info.binary_laps) {
      const grouped = parseBinLaps(decodeBase64Laps(info.binary_laps), 0)
      const laps = grouped[id] ?? Object.values(grouped)[0] ?? []
      for (const lap of laps) driver.lapsData[lap.lapId] = lap
    }
    const validTimes = Object.values(driver.lapsData).filter(isValidLap).sort((a, b) => a.lapTs - b.lapTs)
    driver.bestLap = validTimes.length ? Math.min(...validTimes.map((lap) => lap.lapTime)) : 0
    const last = validTimes.at(-1)
    driver.lastLap = last?.lapTime ?? 0
    driver.lastS1 = last?.sectors.s1 ?? 0
    driver.lastS2 = last?.sectors.s2 ?? 0
    driver.lastS3 = last?.sectors.s3 ?? 0
    driver.laps = validTimes.length || driver.laps
    driver.bestS1 = minPositive(Object.values(driver.lapsData).map((l) => l.sectors.s1))
    driver.bestS2 = minPositive(Object.values(driver.lapsData).map((l) => l.sectors.s2))
    driver.bestS3 = minPositive(Object.values(driver.lapsData).map((l) => l.sectors.s3))
    competitors[id] = driver
  }

  const best = Object.values(competitors).reduce(
    (acc, driver) => (driver.bestLap > 0 && (acc === 0 || driver.bestLap < acc) ? driver.bestLap : acc),
    0,
  )
  const bestDriver = Object.values(competitors).find((driver) => driver.bestLap === best)

  const runName =
    new DOMParser().parseFromString(html, 'text/html').querySelector('#run_name')?.textContent?.trim() ||
    meta?.name ||
    `Заезд ${runId}`

  return {
    status: 'offline',
    source: 'archive',
    run: {
      ...emptyRun(),
      name: runName,
      raceName: meta ? `${meta.date} ${meta.time}`.trim() : '',
      bestLapTime: best,
      bestLapName: bestDriver?.name ?? '',
      bestLapNum: bestDriver?.num ?? '',
      bestLapCid: bestDriver?.id ?? '',
      bestS1: minPositive(Object.values(competitors).map((d) => d.bestS1)),
      bestS2: minPositive(Object.values(competitors).map((d) => d.bestS2)),
      bestS3: minPositive(Object.values(competitors).map((d) => d.bestS3)),
      flag: 3,
      finishType: 'archive',
    },
    competitors,
    updatedAt: Date.now(),
  }
}

function minPositive(values: number[]): number {
  const ok = values.filter((v) => v > 0)
  return ok.length ? Math.min(...ok) : 0
}

function extractJsCompetitors(html: string): Record<string, ArchiveCompetitorJson> | null {
  const startToken = 'var jsCompetitors = '
  const start = html.indexOf(startToken)
  if (start < 0) return null
  let i = start + startToken.length
  while (html[i] && html[i] !== '{') i++
  let depth = 0
  const from = i
  for (; i < html.length; i++) {
    const ch = html[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return JSON.parse(html.slice(from, i + 1)) as Record<string, ArchiveCompetitorJson>
      }
    }
  }
  return null
}
