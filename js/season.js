// Seasonal collections, same as the keyboard app's Season.java. For now: Tết, from three weeks
// before to two weeks after the first day. Dates from timeanddate.com.
const TET = ['2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03'];
const DAY = 864e5;

export function isTet(now = Date.now()) {
  // the first day starts at midnight in Vietnam (UTC+7)
  return TET.some((d) => {
    const first = Date.parse(d + 'T00:00:00+07:00');
    return now >= first - 21 * DAY && now < first + 15 * DAY;
  });
}

export const isTetKind = (kind) => kind.startsWith('tet_');
