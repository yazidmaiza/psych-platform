const CalendarSlot = require('../models/CalendarSlot');
const AvailabilityRule = require('../models/AvailabilityRule');
const AvailabilityException = require('../models/AvailabilityException');

const SLOT_SOURCE_RECURRING = 'recurring';

const parseTime = (value) => {
  const [h, m] = String(value || '').split(':').map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { hour: h, minute: m };
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildUtcFromLocal = ({ year, month, day, hour, minute, offsetMinutes }) => {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) + offsetMinutes * 60 * 1000;
  return new Date(utcMs);
};

const overlaps = (startA, endA, startB, endB) => {
  return startA < endB && startB < endA;
};

const generateRecurringSlots = async ({ psychologistId, rangeStart, rangeEnd }) => {
  const rules = await AvailabilityRule.find({ psychologistId, isActive: true }).lean();
  if (!rules.length) return { created: 0 };

  const startUtc = new Date(rangeStart);
  const endUtc = new Date(rangeEnd);

  const exceptions = await AvailabilityException.find({
    psychologistId,
    date: { $gte: toDateKey(startUtc), $lte: toDateKey(endUtc) }
  }).lean();

  const blockedByDate = new Map();
  const availableByDate = new Map();

  for (const ex of exceptions) {
    if (ex.isAvailable) {
      if (!availableByDate.has(ex.date)) availableByDate.set(ex.date, []);
      availableByDate.get(ex.date).push(ex);
    } else {
      if (!blockedByDate.has(ex.date)) blockedByDate.set(ex.date, []);
      blockedByDate.get(ex.date).push(ex);
    }
  }

  const existing = await CalendarSlot.find({
    psychologistId,
    start: { $gte: startUtc, $lte: endUtc }
  }).select('start end source').lean();

  const existingKeys = new Set(
    existing.map((slot) => `${slot.start.toISOString()}_${slot.end.toISOString()}`)
  );

  let created = 0;
  const newSlots = [];

  for (const rule of rules) {
    const timeStart = parseTime(rule.startTime);
    const timeEnd = parseTime(rule.endTime);
    if (!timeStart || !timeEnd) continue;

    const offsetMinutes = Number(rule.tzOffsetMinutes || 0);
    const cursorLocalStart = new Date(startUtc.getTime() - offsetMinutes * 60 * 1000);
    const cursorLocalEnd = new Date(endUtc.getTime() - offsetMinutes * 60 * 1000);

    const cursor = new Date(cursorLocalStart.getFullYear(), cursorLocalStart.getMonth(), cursorLocalStart.getDate());
    const endLocal = new Date(cursorLocalEnd.getFullYear(), cursorLocalEnd.getMonth(), cursorLocalEnd.getDate());

    while (cursor <= endLocal) {
      if (cursor.getDay() === rule.dayOfWeek) {
        const dateKey = toDateKey(cursor);

        if (blockedByDate.has(dateKey)) {
          const blocks = blockedByDate.get(dateKey);
          const dayBlocked = blocks.some((b) => !b.startTime || !b.endTime);
          if (dayBlocked) {
            cursor.setDate(cursor.getDate() + 1);
            continue;
          }
        }

        const slotStart = buildUtcFromLocal({
          year: cursor.getFullYear(),
          month: cursor.getMonth() + 1,
          day: cursor.getDate(),
          hour: timeStart.hour,
          minute: timeStart.minute,
          offsetMinutes
        });
        const slotEnd = buildUtcFromLocal({
          year: cursor.getFullYear(),
          month: cursor.getMonth() + 1,
          day: cursor.getDate(),
          hour: timeEnd.hour,
          minute: timeEnd.minute,
          offsetMinutes
        });

        if (slotEnd <= slotStart) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        const blockedRanges = blockedByDate.get(dateKey) || [];
        const isBlocked = blockedRanges.some((b) => {
          if (!b.startTime || !b.endTime) return true;
          const blockStart = buildUtcFromLocal({
            year: cursor.getFullYear(),
            month: cursor.getMonth() + 1,
            day: cursor.getDate(),
            hour: parseTime(b.startTime).hour,
            minute: parseTime(b.startTime).minute,
            offsetMinutes
          });
          const blockEnd = buildUtcFromLocal({
            year: cursor.getFullYear(),
            month: cursor.getMonth() + 1,
            day: cursor.getDate(),
            hour: parseTime(b.endTime).hour,
            minute: parseTime(b.endTime).minute,
            offsetMinutes
          });
          return overlaps(slotStart, slotEnd, blockStart, blockEnd);
        });

        if (!isBlocked) {
          const key = `${slotStart.toISOString()}_${slotEnd.toISOString()}`;
          if (!existingKeys.has(key)) {
            newSlots.push({
              psychologistId,
              start: slotStart,
              end: slotEnd,
              isBooked: false,
              source: SLOT_SOURCE_RECURRING,
              timezone: rule.timezone || 'UTC',
              recurrenceRuleId: rule._id
            });
            existingKeys.add(key);
          }
        }

        const extras = availableByDate.get(dateKey) || [];
        for (const extra of extras) {
          if (!extra.startTime || !extra.endTime) continue;
          const extraStart = buildUtcFromLocal({
            year: cursor.getFullYear(),
            month: cursor.getMonth() + 1,
            day: cursor.getDate(),
            hour: parseTime(extra.startTime).hour,
            minute: parseTime(extra.startTime).minute,
            offsetMinutes
          });
          const extraEnd = buildUtcFromLocal({
            year: cursor.getFullYear(),
            month: cursor.getMonth() + 1,
            day: cursor.getDate(),
            hour: parseTime(extra.endTime).hour,
            minute: parseTime(extra.endTime).minute,
            offsetMinutes
          });

          const extraKey = `${extraStart.toISOString()}_${extraEnd.toISOString()}`;
          if (!existingKeys.has(extraKey)) {
            newSlots.push({
              psychologistId,
              start: extraStart,
              end: extraEnd,
              isBooked: false,
              source: SLOT_SOURCE_RECURRING,
              timezone: rule.timezone || 'UTC',
              recurrenceRuleId: rule._id
            });
            existingKeys.add(extraKey);
          }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  if (newSlots.length) {
    await CalendarSlot.insertMany(newSlots);
    created = newSlots.length;
  }

  return { created };
};

module.exports = {
  generateRecurringSlots
};
