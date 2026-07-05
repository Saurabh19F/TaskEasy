'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, AlertTriangle, CheckCircle, Users, FolderKanban,
  Clock, Zap, BarChart3, RefreshCw,
} from 'lucide-react';
import { apiGet } from '@/lib/axios';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TaskRisk {
  taskId: string;
  type: string;
  title: string;
  assigneeName: string;
  deadline: string | null;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
}

interface WorkloadItem {
  userId: string;
  name: string;
  pendingCount: number;
  dueThisWeek: number;
  reworkRate: number;
  burnoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  predictedCompletionRate: number;
}

interface ProjectHealth {
  projectId: string;
  projectName: string;
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  avgDelayDays: number;
  healthScore: number;
  riskLevel: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  recommendations: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function riskColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'text-red-600 dark:text-red-400';
    case 'HIGH': return 'text-orange-600 dark:text-orange-400';
    case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400';
    default: return 'text-green-600 dark:text-green-400';
  }
}

function riskBg(level: string) {
  switch (level) {
    case 'CRITICAL': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
    case 'HIGH': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
    case 'MEDIUM': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
    default: return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
  }
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 25 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8 text-right">{score}</span>
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-green-500' : score >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums">{score}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'tasks' | 'workload' | 'projects';

export default function PredictivePage() {
  const [tab, setTab] = useState<Tab>('tasks');

  const { data: taskRisks = [], isLoading: loadingTasks, refetch: refetchTasks } = useQuery<TaskRisk[]>({
    queryKey: ['predict-tasks'],
    queryFn: () => apiGet('/mis/predict/task-delays'),
    staleTime: 5 * 60_000,
  });

  const { data: workload = [], isLoading: loadingWorkload, refetch: refetchWorkload } = useQuery<WorkloadItem[]>({
    queryKey: ['predict-workload'],
    queryFn: () => apiGet('/mis/predict/workload'),
    enabled: tab === 'workload',
    staleTime: 5 * 60_000,
  });

  const { data: projects = [], isLoading: loadingProjects, refetch: refetchProjects } = useQuery<ProjectHealth[]>({
    queryKey: ['predict-projects'],
    queryFn: () => apiGet('/mis/predict/project-health'),
    enabled: tab === 'projects',
    staleTime: 5 * 60_000,
  });

  const criticalTasks = taskRisks.filter((t) => t.riskLevel === 'CRITICAL').length;
  const highRiskTasks = taskRisks.filter((t) => t.riskLevel === 'HIGH').length;
  const burnoutHighUsers = workload.filter((w) => w.burnoutRisk === 'HIGH').length;
  const criticalProjects = projects.filter((p) => p.riskLevel === 'CRITICAL').length;

  const currentRefetch = tab === 'tasks' ? refetchTasks : tab === 'workload' ? refetchWorkload : refetchProjects;
  const isLoading = tab === 'tasks' ? loadingTasks : tab === 'workload' ? loadingWorkload : loadingProjects;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Predictive Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered risk predictions based on workload, history, and deadlines.
          </p>
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          onClick={() => currentRefetch()}>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Critical Tasks</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{criticalTasks}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">High Risk Tasks</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{highRiskTasks}</p>
        </div>
        <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Burnout Risk</p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{burnoutHighUsers} users</p>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Critical Projects</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{criticalProjects}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {([
          { key: 'tasks', label: 'Task Delay Risk', icon: <AlertTriangle className="h-4 w-4" /> },
          { key: 'workload', label: 'Workload / Burnout', icon: <Users className="h-4 w-4" /> },
          { key: 'projects', label: 'Project Health', icon: <FolderKanban className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Task Delays ── */}
      {tab === 'tasks' && (
        <div className="flex flex-col gap-3">
          {loadingTasks && <p className="text-sm text-muted-foreground py-4 text-center">Analysing task risks…</p>}
          {!loadingTasks && taskRisks.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-medium text-foreground">No at-risk tasks found</p>
              <p className="text-sm text-muted-foreground">All active tasks are within expected timelines.</p>
            </div>
          )}
          {taskRisks.map((t) => (
            <div key={t.taskId}
              className={`rounded-2xl border p-4 flex flex-col gap-3 ${riskBg(t.riskLevel)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Assigned to <span className="font-medium">{t.assigneeName}</span>
                    {t.deadline && <> · Due {formatDate(t.deadline)}</>}
                  </p>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${riskColor(t.riskLevel)}`}>
                  {t.riskLevel}
                </span>
              </div>
              <RiskBar score={t.riskScore} />
              <div className="flex flex-wrap gap-1.5">
                {t.reasons.map((r) => (
                  <span key={r} className="text-[10px] font-medium bg-white/60 dark:bg-black/20
                    rounded-full px-2 py-0.5 text-foreground/80 border border-white/50">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Workload ── */}
      {tab === 'workload' && (
        <div className="flex flex-col gap-3">
          {loadingWorkload && <p className="text-sm text-muted-foreground py-4 text-center">Analysing workloads…</p>}
          {workload.map((w) => (
            <div key={w.userId}
              className={`rounded-2xl border p-4 flex flex-col gap-2 ${riskBg(w.burnoutRisk)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.pendingCount} pending · {w.dueThisWeek} due this week · {Math.round(w.reworkRate * 100)}% rework rate
                  </p>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide ${riskColor(w.burnoutRisk)}`}>
                  {w.burnoutRisk} risk
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Predicted completion: <span className="font-semibold text-foreground">{Math.round(w.predictedCompletionRate * 100)}%</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${w.predictedCompletionRate >= 0.7 ? 'bg-green-500' : w.predictedCompletionRate >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${w.predictedCompletionRate * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Project Health ── */}
      {tab === 'projects' && (
        <div className="flex flex-col gap-3">
          {loadingProjects && <p className="text-sm text-muted-foreground py-4 text-center">Calculating project health…</p>}
          {projects.map((p) => (
            <div key={p.projectId}
              className={`rounded-2xl border p-4 flex flex-col gap-3 ${riskBg(p.riskLevel)}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">{p.projectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.totalTasks} tasks · {p.pendingTasks} pending · {p.overdueTasks} overdue
                    {p.avgDelayDays > 0 && <> · avg {p.avgDelayDays.toFixed(1)}d delay</>}
                  </p>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${riskColor(p.riskLevel)}`}>
                  {p.riskLevel.replace('_', ' ')}
                </span>
              </div>
              <HealthBar score={p.healthScore} />
              <div className="flex flex-wrap gap-1.5">
                {p.recommendations.map((r) => (
                  <span key={r} className="text-[10px] font-medium bg-white/60 dark:bg-black/20
                    rounded-full px-2 py-0.5 text-foreground/80 border border-white/50">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
