import { minutesToTime, timeInMinutes, type EventDetails } from "./calendar-events";

export type Activity = { name: string; selected: boolean; minutes: number };
export type TimeSlot = { start: number; end: number };

const defaults: Activity[] = ["Walk", "Dinner", "Reading"].map((name) => ({
  name,
  selected: false,
  minutes: 30,
}));

const draftKey = (date: string) => `eveningDraft:${date}`;

export function readDraft(date: string) {
  return sessionStorage.getItem(draftKey(date));
}

export function loadDraft(raw: string | null): Activity[] {
  return raw ? JSON.parse(raw) : defaults;
}

export function saveDraft(date: string, activities: Activity[]) {
  sessionStorage.setItem(draftKey(date), JSON.stringify(activities));
  window.dispatchEvent(new Event("storage"));
}

export function clearDraft(date: string) {
  sessionStorage.removeItem(draftKey(date));
}

export function eveningSlots(events: EventDetails[]): TimeSlot[] {
  const defaultEnd = timeInMinutes("22:00");
  const bedtime = events.find((event) => event.title.trim().toLowerCase() === "bedtime");
  const cutoff = bedtime ? timeInMinutes(bedtime.startTime) : defaultEnd;
  const slots: TimeSlot[] = [];
  let start = timeInMinutes("16:00");

  for (const event of events) {
    const busyStart = timeInMinutes(event.startTime);
    if (busyStart >= cutoff) break;
    if (busyStart > start) slots.push({ start, end: busyStart });
    start = Math.max(start, timeInMinutes(event.endTime));
  }

  if (start < cutoff) slots.push({ start, end: cutoff });
  return slots;
}

export function arrangeActivities(activities: Activity[], slots: TimeSlot[]) {
  const available = slots.reduce((sum, slot) => sum + slot.end - slot.start, 0);
  if (activities.reduce((sum, activity) => sum + activity.minutes, 0) > available) return null;

  const ordered = [...activities].sort((a, b) => b.minutes - a.minutes);
  const gaps = slots.map((slot) => ({ ...slot }));
  const plan: { name: string; start: string; end: string }[] = [];

  // Try alternate gaps when an earlier choice would leave a later activity without a slot.
  function place(index: number): boolean {
    if (index === ordered.length) return true;
    const activity = ordered[index];
    const tried = new Set<number>();

    for (const gap of gaps) {
      const capacity = gap.end - gap.start;
      if (activity.minutes > capacity || tried.has(capacity)) continue;
      tried.add(capacity);

      const start = gap.start;
      const end = start + activity.minutes;
      plan.push({ name: activity.name, start: minutesToTime(start), end: minutesToTime(end) });
      gap.start = end;
      if (place(index + 1)) return true;
      gap.start = start;
      plan.pop();
    }

    return false;
  }

  return place(0) ? plan.sort((a, b) => a.start.localeCompare(b.start)) : null;
}
