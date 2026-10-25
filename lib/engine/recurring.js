const { addDays, addMonthsClamped } = require("../dates");

function nextDate(ymd, frequency) {
  switch (frequency) {
    case "daily":
      return addDays(ymd, 1);
    case "weekly":
      return addDays(ymd, 7);
    case "monthly":
      return addMonthsClamped(ymd, 1);
    case "yearly":
      return addMonthsClamped(ymd, 12);
    default:
      return null;
  }
}

function occurrenceKey(scheduleId, ymd) {
  return `${scheduleId}:${ymd}`;
}

function generateOccurrences(schedule, rangeStart, rangeEnd) {
  if (!schedule || schedule.frequency === "once") {
    const date = schedule.anchorDate;
    if (date >= rangeStart && date <= rangeEnd) {
      return [{ date, occurrenceKey: occurrenceKey(schedule.id, date) }];
    }
    return [];
  }
  const out = [];
  let seen = 0;
  let cursor = schedule.anchorDate;
  while (cursor < rangeStart) {
    const n = nextDate(cursor, schedule.frequency);
    if (!n || n <= cursor) break;
    cursor = n;
    if (++seen > 400) break;
  }
  seen = 0;
  while (cursor <= rangeEnd) {
    if (schedule.endDate && cursor > schedule.endDate) break;
    if (cursor >= rangeStart) out.push({ date: cursor, occurrenceKey: occurrenceKey(schedule.id, cursor) });
    const n = nextDate(cursor, schedule.frequency);
    if (!n || n <= cursor) break;
    cursor = n;
    if (++seen > 400) break;
  }
  return out;
}

module.exports = { nextDate, occurrenceKey, generateOccurrences };
