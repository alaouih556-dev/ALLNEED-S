import type { Tone } from '@/components/ui'
import type { OrgTask, TaskStats } from './core'

export type StrategyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type Objective = { id: string; title: string; metric: string; target: number | null; current: number | null; unit: string; dueDate: string | null }
export type Strategy = {
  id: string; title: string; summary: string; audience: string; channels: string; status: StrategyStatus; startDate: string | null; endDate: string | null
  objectives: Objective[]; ownerName: string | null; taskStats: TaskStats; objectiveProgress: number | null; canManage: boolean
}
export type StrategyDetail = { strategy: Strategy; tasks: OrgTask[] }

export const STRATEGY_STATUS: Record<StrategyStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'En pause', tone: 'warning' },
  completed: { label: 'Terminée', tone: 'info' },
  archived: { label: 'Archivée', tone: 'neutral' },
}
