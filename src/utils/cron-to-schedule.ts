export type ScheduleOutput =
  | { type: 'DAILY'; time: string }
  | { type: 'WEEKLY'; day: string; time: string }
  | { type: 'MONTHLY'; date: number; time: string }
  | { type: 'LAST_DAY_OF_MONTH'; time: string }
  | { type: 'EVERY_X_MINUTES'; minutes: number };

export function parseCronToSchedule(cron: string): ScheduleOutput | null {
  const parts = cron.split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // every x minutes
  if (minute.startsWith('*/')) {
    return {
      type: 'EVERY_X_MINUTES',
      minutes: Number(minute.replace('*/', '')),
    };
  }

  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

  // daily
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    return { type: 'DAILY', time };
  }

  // last day
  if (dayOfMonth === 'L') {
    return { type: 'LAST_DAY_OF_MONTH', time };
  }

  // monthly
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    return { type: 'MONTHLY', date: Number(dayOfMonth), time };
  }

  // weekly
  if (dayOfWeek !== '*') {
    const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return { type: 'WEEKLY', day: map[Number(dayOfWeek)], time };
  }

  return null;
}