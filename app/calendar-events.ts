export interface EventDetails {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  repeat: "none" | "daily" | "weekdays" | "weekly";
}

const STORAGE_KEY = "events";
const EXCEPTIONS_KEY = "eventExceptions";

export const serverSnapshot = () => null;
export const getToday = () => dateKey(new Date());

export function subscribeToStorage(notify: () => void) {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

export function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function readStoredEvents() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readStoredExceptions() {
  try {
    return localStorage.getItem(EXCEPTIONS_KEY);
  } catch {
    return null;
  }
}

export function loadExceptions(raw: string | null): Record<string, string[]> {
  try {
    return JSON.parse(raw ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function saveEvents(events: EventDetails[], exceptions?: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  if (exceptions) localStorage.setItem(EXCEPTIONS_KEY, JSON.stringify(exceptions));
  window.dispatchEvent(new Event("storage"));
}

export function getSelectedDate(value: string | null, today: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    if (dateKey(date) === value) return date;
  }
  return new Date(`${today}T12:00:00`);
}

export function eventsOnDay(events: EventDetails[], key: string, exceptions: Record<string, string[]>) {
  const weekday = new Date(`${key}T12:00:00`).getDay();

  return events.filter((event) => {
    if (exceptions[event.id]?.includes(key) || event.date > key) return false;
    if (event.date === key || event.repeat === "daily") return true;
    if (event.repeat === "weekdays") return weekday >= 1 && weekday <= 5;
    return event.repeat === "weekly" && new Date(`${event.date}T12:00:00`).getDay() === weekday;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function timeInMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainder = String(minutes % 60).padStart(2, "0");
  return `${hours}:${remainder}`;
}

const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function timeRange(start: string, end: string) {
  const format = (time: string) => timeFormat.format(new Date(`2000-01-01T${time}:00`));
  return `${format(start)} – ${format(end)}`;
}

function exampleEvents(date: string): EventDetails[] {
  return [
    { id: "work", title: "Work Shift", startTime: "12:00", endTime: "16:00" },
    { id: "travel", title: "Travel Home", startTime: "16:00", endTime: "16:30" },
    { id: "friends", title: "Meet with Friends", startTime: "18:00", endTime: "20:00" },
    { id: "bedtime", title: "Bedtime", startTime: "22:00", endTime: "23:00" },
  ].map((event) => ({
    ...event,
    date,
    location: "",
    description: "",
    repeat: "none",
  }));
}

export function loadEvents(raw: string | null, today: string): EventDetails[] {
  if (raw === null) return exampleEvents(today);

  try {
    const events = JSON.parse(raw);
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export function seedExampleEvents(today: string) {
  try {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleEvents(today)));
    }
  } catch {
    // The sample agenda can still be displayed when storage is unavailable.
  }
}
