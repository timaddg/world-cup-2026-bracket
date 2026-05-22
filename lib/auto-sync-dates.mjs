/** Shared date rules for daily group-results sync (June 11–27, 2026). */
export const AUTO_SYNC = {
  start: "2026-06-11",
  end: "2026-06-27",
  timezone: "America/New_York",
  intervalHours: 24,
};

function calendarDayInTz(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isWithinAutoSyncWindow(now = new Date()) {
  const day = calendarDayInTz(now, AUTO_SYNC.timezone);
  return day >= AUTO_SYNC.start && day <= AUTO_SYNC.end;
}

export function shouldRunDailySync(lastSyncedAt, now = new Date()) {
  if (!isWithinAutoSyncWindow(now)) return false;
  if (!lastSyncedAt) return true;
  const elapsed = now.getTime() - lastSyncedAt;
  return elapsed >= AUTO_SYNC.intervalHours * 60 * 60 * 1000;
}
