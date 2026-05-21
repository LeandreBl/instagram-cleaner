import type { DateRange } from '../types.js';

export function parseDateValue(value: unknown, label: string): Date | null {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (/^\d+$/.test(raw)) {
    const number = Number(raw);
    const milliseconds = raw.length <= 10 ? number * 1000 : number;
    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for ${label}: ${raw}`);
  }

  return date;
}

export function parseRange(range?: string, from?: string, to?: string): DateRange {
  let minimum = parseDateValue(from, '--from');
  let maximum = parseDateValue(to, '--to');

  if (range) {
    const [rangeFrom = '', rangeTo = '', extra] = range.split(':');

    if (extra !== undefined) {
      throw new Error('--range must use the min:max format.');
    }

    minimum = parseDateValue(rangeFrom, '--range min') ?? minimum;
    maximum = parseDateValue(rangeTo, '--range max') ?? maximum;
  }

  if (minimum && maximum && minimum > maximum) {
    throw new Error('The minimum date is after the maximum date.');
  }

  return { from: minimum, to: maximum };
}

export function formatDateForInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

export function formatRange(range: DateRange): string {
  if (!range.from && !range.to) {
    return 'everything';
  }

  return `${range.from ? range.from.toISOString() : '-∞'} → ${range.to ? range.to.toISOString() : '+∞'}`;
}
