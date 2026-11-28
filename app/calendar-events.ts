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


export function occursOn(event: EventDetails, date: Date, key: string, excludedDates: string[] = []) {
  if (excludedDates.includes(key) || event.date > key) return false;
  if (event.date === key || event.repeat === "daily") return true;

  const weekday = date.getDay();
  if (event.repeat === "weekdays") return weekday >= 1 && weekday <= 5;
  return event.repeat === "weekly" && new Date(`${event.date}T12:00:00`).getDay() === weekday;
}

export function timeInMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function readStoredExceptions() {
  return localStorage.getItem("eventExceptions");
}

export function loadExceptions(raw: string | null): Record<string, string[]> {
  try {
    return JSON.parse(raw ?? "{}") ?? {};
  } catch {
    return {};
  }
}
