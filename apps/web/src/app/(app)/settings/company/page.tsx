'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore',
];

const SHIFT_OPTIONS = [
  'General Shift',
  'Morning Shift',
  'Day Shift',
  'Evening Shift',
  'Night Shift',
  'Custom Shift',
];

const WEEK_TYPE_OPTIONS = [
  'Monday to Friday',
  'Monday to Saturday',
  'Monday to Sunday',
  'Sunday to Thursday',
  'Custom',
];

const SATURDAY_POLICY_OPTIONS = [
  'None',
  '2nd Saturday Off',
  '2nd & 4th Saturday Off',
  'All Saturdays Off',
];

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

type CompanySettingsForm = {
  timezone: string;
  officeShiftName: string;
  workingWeekType: string;
  workingDays: number[];
  weeklyOffDays: number[];
  alternateSaturdayOff: boolean;
  saturdayPolicy: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  punchInStartTime: string;
  punchInEndTime: string;
  totalWorkingHours: number;
};

function parseHours(timeStart: string, timeEnd: string) {
  if (!timeStart || !timeEnd) return 0;
  const [startHour, startMinute] = timeStart.split(':').map(Number);
  const [endHour, endMinute] = timeEnd.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const diff = end >= start ? end - start : end + 24 * 60 - start;
  return Number((diff / 60).toFixed(2));
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(2)}`;
}

function toggleValue(values: number[], value: number) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value].sort((a, b) => a - b);
}

function weekTypeDefaults(weekType: string) {
  switch (weekType) {
    case 'Monday to Friday':
      return { workingDays: [1, 2, 3, 4, 5], weeklyOffDays: [6, 7] };
    case 'Monday to Saturday':
      return { workingDays: [1, 2, 3, 4, 5, 6], weeklyOffDays: [7] };
    case 'Monday to Sunday':
      return { workingDays: [1, 2, 3, 4, 5, 6, 7], weeklyOffDays: [] };
    case 'Sunday to Thursday':
      return { workingDays: [7, 1, 2, 3, 4], weeklyOffDays: [5, 6] };
    default:
      return null;
  }
}

function getInitialSettings(tenant: any): CompanySettingsForm {
  const workingHoursStart = tenant?.workingHoursStart ?? '09:30';
  const workingHoursEnd = tenant?.workingHoursEnd ?? '18:30';
  return {
    timezone: tenant?.timezone ?? 'Asia/Kolkata',
    officeShiftName: tenant?.officeShiftName ?? 'General Shift',
    workingWeekType: tenant?.workingWeekType ?? 'Monday to Saturday',
    workingDays: tenant?.workingDays ?? [1, 2, 3, 4, 5, 6],
    weeklyOffDays: tenant?.weeklyOffDays ?? [7],
    alternateSaturdayOff: tenant?.alternateSaturdayOff ?? false,
    saturdayPolicy: tenant?.saturdayPolicy ?? '2nd & 4th Saturday Off',
    workingHoursStart,
    workingHoursEnd,
    punchInStartTime: tenant?.punchInStartTime ?? '09:00',
    punchInEndTime: tenant?.punchInEndTime ?? '09:40',
    totalWorkingHours: tenant?.totalWorkingHours ?? parseHours(workingHoursStart, workingHoursEnd),
  };
}

export default function CompanySettingsPage() {
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiGet<any>('/tenants/me/settings'),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['tenant-holidays'],
    queryFn: () => apiGet<any[]>('/tenants/me/holidays'),
  });

  const [settings, setSettings] = useState<CompanySettingsForm>(() => getInitialSettings(null));

  useEffect(() => {
    if (tenant) setSettings(getInitialSettings(tenant));
  }, [tenant]);

  const totalWorkingHours = useMemo(
    () => parseHours(settings.workingHoursStart, settings.workingHoursEnd),
    [settings.workingHoursStart, settings.workingHoursEnd],
  );

  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  const saveMutation = useMutation({
    mutationFn: () => apiPatch('/tenants/me/settings', {
      ...settings,
      totalWorkingHours,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const addHolidayMutation = useMutation({
    mutationFn: () => apiPost('/tenants/me/holidays', newHoliday),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      qc.invalidateQueries({ queryKey: ['tenant-holidays'] });
      setNewHoliday({ date: '', name: '' });
      toast.success('Holiday added');
    },
    onError: () => toast.error('Failed to add holiday'),
  });

  const removeHolidayMutation = useMutation({
    mutationFn: (hid: string) => apiDelete(`/tenants/me/holidays/${hid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      qc.invalidateQueries({ queryKey: ['tenant-holidays'] });
      toast.success('Holiday removed');
    },
  });

  const applyWeekType = (weekType: string) => {
    const defaults = weekTypeDefaults(weekType);
    setSettings((current) => ({
      ...current,
      workingWeekType: weekType,
      ...(defaults ? defaults : {}),
    }));
  };

  const toggleDay = (value: number) => {
    setSettings((current) => ({
      ...current,
      workingDays: toggleValue(current.workingDays, value),
    }));
  };

  const toggleOffDay = (value: number) => {
    setSettings((current) => ({
      ...current,
      weeklyOffDays: toggleValue(current.weeklyOffDays, value),
    }));
  };

  const dayLabel = (value: number) => DAYS.find((day) => day.value === value)?.label ?? String(value);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <Building2 className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Company Settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Office Shift Setup</h2>
              <p className="text-sm text-slate-500">Shift, work week, and punch window settings for the tenant.</p>
            </div>
            <div className="rounded-xl bg-indigo-50 px-3 py-2 text-right dark:bg-indigo-900/20">
              <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Auto Working Hours</p>
              <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">
                {formatHours(totalWorkingHours)} Hours
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Office Shift Name"
              value={settings.officeShiftName}
              onChange={(e) => setSettings((s) => ({ ...s, officeShiftName: e.target.value }))}
            >
              {SHIFT_OPTIONS.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
            </Select>

            <Select
              label="Working Week Type"
              value={settings.workingWeekType}
              onChange={(e) => applyWeekType(e.target.value)}
            >
              {WEEK_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>

            <Input
              type="time"
              label="Office Start Time"
              value={settings.workingHoursStart}
              onChange={(e) => setSettings((s) => ({ ...s, workingHoursStart: e.target.value }))}
            />
            <Input
              type="time"
              label="Office End Time"
              value={settings.workingHoursEnd}
              onChange={(e) => setSettings((s) => ({ ...s, workingHoursEnd: e.target.value }))}
            />

            <Input
              type="time"
              label="Punch In Start Time"
              value={settings.punchInStartTime}
              onChange={(e) => setSettings((s) => ({ ...s, punchInStartTime: e.target.value }))}
            />
            <Input
              type="time"
              label="Punch In End Time"
              value={settings.punchInEndTime}
              onChange={(e) => setSettings((s) => ({ ...s, punchInEndTime: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Working Days</label>
                <span className="text-xs text-slate-500">Multi-select</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      settings.workingDays.includes(day.value)
                        ? 'bg-indigo-600 text-contrast'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Selected: {settings.workingDays.map(dayLabel).join(', ') || 'None'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Weekly Off Days</label>
                <span className="text-xs text-slate-500">Multi-select</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleOffDay(day.value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      settings.weeklyOffDays.includes(day.value)
                        ? 'bg-emerald-600 text-contrast'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Selected: {settings.weeklyOffDays.map(dayLabel).join(', ') || 'None'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alternate Saturday Off</label>
                  <p className="text-xs text-slate-500">Turn on when alternate Saturdays should be non-working.</p>
                </div>
                <Button
                  type="button"
                  variant={settings.alternateSaturdayOff ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSettings((s) => ({ ...s, alternateSaturdayOff: !s.alternateSaturdayOff }))}
                >
                  {settings.alternateSaturdayOff ? 'Yes' : 'No'}
                </Button>
              </div>
            </div>

            <Select
              label="Saturday Policy"
              value={settings.saturdayPolicy}
              onChange={(e) => setSettings((s) => ({ ...s, saturdayPolicy: e.target.value }))}
            >
              {SATURDAY_POLICY_OPTIONS.map((policy) => (
                <option key={policy} value={policy}>{policy}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Total Working Hours"
            value={`${formatHours(totalWorkingHours)} Hours`}
            readOnly
            helperText="Auto calculated from office start and end time."
          />

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Time Zone and Holidays</h2>

          <Select
            label="Timezone"
            value={settings.timezone}
            onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </Select>

          <div className="flex gap-2">
            <Input
              type="date"
              placeholder="Date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
              className="flex-1"
            />
            <Input
              placeholder="Holiday name"
              value={newHoliday.name}
              onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
              className="flex-1"
            />
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => addHolidayMutation.mutate()}
              loading={addHolidayMutation.isPending}
              disabled={!newHoliday.date || !newHoliday.name}
            >
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {holidays.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                <div>
                  <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{h.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{formatDate(h.date)}</span>
                </div>
                <button
                  onClick={() => removeHolidayMutation.mutate(h.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!holidays.length && (
              <p className="text-sm text-slate-500 text-center py-4">No holidays added yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
