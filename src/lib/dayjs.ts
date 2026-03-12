import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/**
 * Application timezone — read from env, default to Asia/Bangkok.
 * All server-side timestamps use this instead of server local time.
 */
export const APP_TIMEZONE = process.env.TZ || 'Asia/Bangkok';

/** Pre-configured dayjs instance that always uses the app timezone */
export function now() {
  return dayjs().tz(APP_TIMEZONE);
}

/** Convert any date to app timezone */
export function toAppTz(date: Date | string | number) {
  return dayjs(date).tz(APP_TIMEZONE);
}

/** Format a date in app timezone */
export function formatDate(date: Date | string | number, format = 'YYYY-MM-DD HH:mm:ss') {
  return toAppTz(date).format(format);
}

/** Format relative time (e.g., "2 hours ago") */
export function fromNow(date: Date | string | number) {
  return toAppTz(date).fromNow();
}

export { dayjs };
