function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Minutes since midnight for `date` in the given IANA time zone.
export function minutesInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

// Open interval is [open, close). Same-day hours only (no overnight span).
export function isOpenAt(
  date: Date,
  openTime: string,
  closeTime: string,
  timeZone: string,
): boolean {
  const now = minutesInZone(date, timeZone);
  return now >= toMinutes(openTime) && now < toMinutes(closeTime);
}
