'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/axios';

import { useActiveUsers } from '@/hooks/useUsers';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  status: string;
  type: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS' | 'HOLIDAY' | 'BIRTHDAY' | 'ANNIVERSARY';
}

const TYPE_COLORS: Record<string, string> = {
  DELEGATION: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  WORK_REQUEST: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  CHECKLIST: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FMS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  HOLIDAY: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  BIRTHDAY: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  ANNIVERSARY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: activeUsers = [] } = useActiveUsers();

  const celebrationEvents: CalendarEvent[] = useMemo(() => {
    const evts: CalendarEvent[] = [];
    for (const u of activeUsers as any[]) {
      if (u.dateOfBirth) {
        const dob = new Date(u.dateOfBirth);
        if (dob.getMonth() === month) {
          evts.push({
            id: `bday-${u.id}`,
            title: `🎂 ${u.name}'s Birthday`,
            date: new Date(year, month, dob.getDate()).toISOString(),
            status: 'CELEBRATION',
            type: 'BIRTHDAY',
          });
        }
      }
      if (u.anniversaryDate) {
        const ann = new Date(u.anniversaryDate);
        if (ann.getMonth() === month) {
          evts.push({
            id: `anniv-${u.id}`,
            title: `🎉 ${u.name}'s Anniversary`,
            date: new Date(year, month, ann.getDate()).toISOString(),
            status: 'CELEBRATION',
            type: 'ANNIVERSARY',
          });
        }
      }
    }
    return evts;
  }, [activeUsers, year, month]);

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () =>
      apiGet<{
        delegation: CalendarEvent[];
        workRequests: CalendarEvent[];
        checklist: CalendarEvent[];
        fms: CalendarEvent[];
        holidays: CalendarEvent[];
      }>('/calendar/events', { from, to }),
  });

  const allEvents: CalendarEvent[] = [
    ...(events?.holidays ?? []),
    ...(events?.delegation ?? []),
    ...(events?.workRequests ?? []),
    ...(events?.checklist ?? []),
    ...(events?.fms ?? []),
    ...celebrationEvents,
  ];

  const holidayDays = new Set(
    (events?.holidays ?? []).map((h) => new Date(h.date).getDate()),
  );

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of allEvents) {
    const d = new Date(ev.date).getDate();
    (eventsByDay[d] ??= []).push(ev);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Calendar</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-300 w-36 text-center">
            {monthName} {year}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_COLORS).map(([type, cls]) => (
          <span key={type} className={`rounded-full px-2 py-1 font-medium ${cls}`}>
            {type.replace('_', ' ')}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{d}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {blanks.map((b) => (
              <div key={`blank-${b}`} className="min-h-[100px] p-1 border-b border-r border-slate-100 dark:border-slate-800" />
            ))}
            {days.map((day) => {
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isHoliday = holidayDays.has(day);
              const dayEvents = eventsByDay[day] ?? [];
              return (
                <div
                  key={day}
                  className={`min-h-[100px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800 ${
                    isHoliday ? 'bg-red-50 dark:bg-red-950/20' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-indigo-600 text-contrast' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`rounded px-1 py-0.5 text-xs truncate ${TYPE_COLORS[ev.type] ?? ''}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
