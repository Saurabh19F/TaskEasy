'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

// ─── Shared tooltip style ────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'rgb(var(--surface))',
    border: '1px solid rgb(var(--border))',
    borderRadius: '14px',
    fontSize: '12px',
    boxShadow: '0 20px 60px -36px rgba(15, 23, 42, 0.6)',
  },
};

// ─── Completion Trend (line) ─────────────────────────────────────────────────

interface TrendPoint {
  label: string;   // e.g. "Mon", "Week 1", "Jan"
  completed: number;
  pending: number;
  delayed: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  title?: string;
  height?: number;
}

export function TrendChart({ data, title, height = 220 }: TrendChartProps) {
  return (
    <div className="surface-card p-5">
      {title && (
        <p className="mb-4 text-sm font-semibold tracking-tight text-foreground">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="completed" stroke="rgb(34 197 94)" strokeWidth={2.5} dot={false} name="Completed" />
          <Line type="monotone" dataKey="pending"   stroke="rgb(245 158 11)" strokeWidth={2.5} dot={false} name="Pending" />
          <Line type="monotone" dataKey="delayed"   stroke="rgb(244 63 94)" strokeWidth={2.5} dot={false} name="Delayed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Module Bar Chart ────────────────────────────────────────────────────────

interface ModuleBarPoint {
  module: string;
  total: number;
  done: number;
  pending: number;
  delayed: number;
}

interface ModuleBarChartProps {
  data: ModuleBarPoint[];
  title?: string;
  height?: number;
}

export function ModuleBarChart({ data, title, height = 220 }: ModuleBarChartProps) {
  return (
    <div className="surface-card p-5">
      {title && (
        <p className="mb-4 text-sm font-semibold tracking-tight text-foreground">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 12, left: -20, bottom: 0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="module" tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="done"    fill="rgb(34 197 94)" radius={[6,6,0,0]} name="Done" />
          <Bar dataKey="pending" fill="rgb(245 158 11)" radius={[6,6,0,0]} name="Pending" />
          <Bar dataKey="delayed" fill="rgb(244 63 94)" radius={[6,6,0,0]} name="Delayed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
