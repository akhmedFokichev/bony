import { isValidLap, type Competitor, type Lap } from './protocol'

export type DriverStats = {
  validLaps: Lap[]
  best: number
  avg: number
  last: number
  theoretical: number
  stdev: number
  consistency: number
  spread: number
  within102: number
  rolling3: number
  bestS1: number
  bestS2: number
  bestS3: number
}

export function sortedLaps(competitor: Competitor): Lap[] {
  return Object.values(competitor.lapsData).sort((a, b) => a.lapTs - b.lapTs)
}

export function analyze(competitor: Competitor): DriverStats {
  const validLaps = sortedLaps(competitor).filter(isValidLap)
  const times = validLaps.map((lap) => lap.lapTime)
  const best = times.length ? Math.min(...times) : competitor.bestLap
  const last = times.at(-1) ?? competitor.lastLap
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : competitor.avgLap
  const variance =
    times.length > 1 ? times.reduce((sum, t) => sum + (t - avg) ** 2, 0) / (times.length - 1) : 0
  const stdev = Math.sqrt(variance)
  const consistency = avg > 0 ? Math.max(0, 100 * (1 - stdev / avg)) : 0
  const spread = times.length ? Math.max(...times) - Math.min(...times) : 0
  const within102 = best > 0 ? times.filter((t) => t <= best * 1.02).length : 0
  const last3 = times.slice(-3)
  const rolling3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0

  const s1 = validLaps.map((l) => l.sectors.s1).filter((v) => v > 0)
  const s2 = validLaps.map((l) => l.sectors.s2).filter((v) => v > 0)
  const s3 = validLaps.map((l) => l.sectors.s3).filter((v) => v > 0)
  const bestS1 = s1.length ? Math.min(...s1) : competitor.bestS1
  const bestS2 = s2.length ? Math.min(...s2) : competitor.bestS2
  const bestS3 = s3.length ? Math.min(...s3) : competitor.bestS3
  const theoretical =
    bestS1 && bestS2 && bestS3 ? bestS1 + bestS2 + bestS3 : competitor.theoretical

  return {
    validLaps,
    best,
    avg,
    last,
    theoretical,
    stdev,
    consistency,
    spread,
    within102,
    rolling3,
    bestS1,
    bestS2,
    bestS3,
  }
}

export function rankedCompetitors(map: Record<string, Competitor>): Competitor[] {
  return Object.values(map).sort((a, b) => {
    if (a.pos && b.pos) return a.pos - b.pos
    if (a.bestLap && b.bestLap) return a.bestLap - b.bestLap
    return a.num.localeCompare(b.num, 'ru')
  })
}
