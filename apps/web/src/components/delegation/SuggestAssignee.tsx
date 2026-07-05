'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, User, CheckCircle, TrendingDown, Clock, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/axios';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface SuggestedUser {
  id: string;
  name: string;
  email: string;
  designation?: string;
  avatarUrl?: string;
  pendingCount: number;
  completedCount: number;
  reworkCount: number;
  lateCount: number;
  onTimeRate: number;
  score: number;
}

interface Props {
  onSelect: (userId: string, userName: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}pts
    </span>
  );
}

export function SuggestAssignee({ onSelect }: Props) {
  const [open, setOpen] = useState(false);

  const { data: suggestions = [], isLoading, refetch } = useQuery<SuggestedUser[]>({
    queryKey: ['suggest-assignee'],
    queryFn: () => apiGet<SuggestedUser[]>('/users/suggest-assignee'),
    enabled: open,
    staleTime: 30_000,
  });

  const handleSelect = (u: SuggestedUser) => {
    onSelect(u.id, u.name);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon={<Sparkles className="h-3.5 w-3.5 text-yellow-500" />}
        onClick={() => setOpen(true)}
      >
        Suggest Best Assignee
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Smart Assignment — Best Candidates"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground mb-2">
            Ranked by availability, on-time rate, and recent rework count. Lower workload = higher score.
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-6">No eligible team members found.</p>
          )}

          {suggestions.map((u, idx) => (
            <div
              key={u.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface/60
                         hover:border-primary/50 hover:bg-primary/5 transition-all p-3 cursor-pointer"
              onClick={() => handleSelect(u)}
            >
              {/* Rank */}
              <span className="w-6 text-center text-sm font-bold text-muted-foreground shrink-0">
                #{idx + 1}
              </span>

              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {u.avatarUrl
                  ? <img src={u.avatarUrl} alt={u.name} className="h-full w-full object-cover" />
                  : <User className="h-4 w-4 text-primary" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.designation ?? u.email}</p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {u.pendingCount} pending
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> {u.onTimeRate}% on-time
                </span>
                {u.reworkCount > 0 && (
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-red-400" /> {u.reworkCount} rework
                  </span>
                )}
              </div>

              {/* Score */}
              <ScoreBadge score={u.score} />

              {/* Select hint */}
              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium shrink-0">
                Select →
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
