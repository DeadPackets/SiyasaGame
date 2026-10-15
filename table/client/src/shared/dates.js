// Pack dates are "YYYY-MM[-DD]" and the year may be negative (BC), which JS Date cannot parse, so names come from a table.
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthName(ym) {
  const m = /^(-?\d+)-(\d{2})/.exec(String(ym));
  if (!m) return String(ym);
  const y = +m[1];
  return `${LONG[+m[2] - 1]} ${y < 0 ? `${-y} BC` : y}`;
}
