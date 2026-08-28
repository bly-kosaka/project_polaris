const APACHE_TIMESTAMP_PATTERN =
  /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/;

const MONTHS: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

/**
 * Converts the Apache/Nginx bracketed timestamp (e.g. `10/Oct/2023:13:55:36 +0000`)
 * to an ISO-8601 string. Returns `undefined` when the value doesn't match —
 * callers turn that into a partial-parse warning rather than a guess.
 */
export function parseAccessLogTimestamp(raw: string): string | undefined {
  const match = APACHE_TIMESTAMP_PATTERN.exec(raw);
  if (!match) {
    return undefined;
  }
  const [, day, monthName, year, hour, minute, second, offset] = match;
  if (
    day === undefined ||
    monthName === undefined ||
    year === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    offset === undefined
  ) {
    return undefined;
  }
  const month = MONTHS[monthName];
  if (!month) {
    return undefined;
  }
  const isoOffset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}
