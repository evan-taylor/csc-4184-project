"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Repeat = "none" | "daily" | "weekdays" | "weekly";

interface EventDetails {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  repeat: Repeat;
}

const STORAGE_KEY = "events";

function loadEvents(): EventDetails[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvent(event: EventDetails) {
  const events = loadEvents();
  const index = events.findIndex((e) => e.id === event.id);

  if (index >= 0) {
    events[index] = event; // update existing event
  } else {
    events.push(event); // add new event
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1 to 12 for the hour
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")); // 00 to 59 for minutes

const REPEATS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday (Mon–Fri)" },
  { value: "weekly", label: "Every week" },
];

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
}) {
  const [hStr, minute] = value.split(":");
  const h24 = Number(hStr);
  const period = h24 < 12 ? "AM" : "PM";
  const hour12 = String(h24 % 12 || 12);

  function handleChange(nextHour: string, nextMinute: string, nextPeriod: string) {
    let h = Number(nextHour) % 12;
    if (nextPeriod === "PM") h += 12;
    onChange(`${String(h).padStart(2, "0")}:${nextMinute}`);
  }

  return (
    <div className="flex flex-col gap-1">
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        <select
          className="w-16 bg-gray-200 py-2 pl-2.5 pr-1"
          value={hour12}
          onChange={(e) => handleChange(e.target.value, minute, period)}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="font-medium">:</span>

        <select
          className="w-16 bg-gray-200 py-2 pl-2.5 pr-1"
          value={minute}
          onChange={(e) => handleChange(hour12, e.target.value, period)}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          className="w-16 bg-gray-200 py-2 pl-2.5 pr-1"
          value={period}
          onChange={(e) => handleChange(hour12, minute, e.target.value)}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  const router = useRouter();

  const [event, setEvent] = useState<EventDetails>({
    id: "",
    date: "",
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    description: "",
    repeat: "none",
  });

  useEffect(() => {
    const paramDate = new URLSearchParams(window.location.search).get("date");
    const validParam = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : null;

    setEvent((prev) => ({
      ...prev,
      date: validParam || new Date().toLocaleDateString("en-CA"),
    }));
  }, []);

  function update<K extends keyof EventDetails>(field: K, value: EventDetails[K]) {
    setEvent((prev) => ({ ...prev, [field]: value }));
  }

  const timeError =
    event.endTime <= event.startTime ? "End time must be after the start time." : "";
  const canSave = event.title.trim() !== "" && event.date !== "" && !timeError;

  function handleSave() {
    if (!canSave) return;
    saveEvent({ ...event, id: crypto.randomUUID() });
    router.push(`/?date=${event.date}`);
  }

  return (
    <div className="relative mx-auto my-6 flex min-h-[700px] w-[360px] flex-col gap-4 overflow-hidden bg-white px-6 pb-6 pt-16 text-black">
      <button
        onClick={() => router.back()}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-pink-100"
        aria-label="Close"
      >
        X
      </button>

      <label className="flex flex-col gap-1">
        Event Title
        <input
          className="bg-gray-200 p-2"
          value={event.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        Date
        <input
          type="date"
          className="bg-gray-200 p-2"
          value={event.date}
          onChange={(e) => update("date", e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-3">
        <TimeSelect
          label="Start Time"
          value={event.startTime}
          onChange={(val) => update("startTime", val)}
        />
        <TimeSelect
          label="End Time"
          value={event.endTime}
          onChange={(val) => update("endTime", val)}
        />
      </div>

      {timeError && <p className="text-sm text-red-600">{timeError}</p>}

      <label className="flex flex-col gap-1">
        Repeat
        <select
          className="bg-gray-200 p-2"
          value={event.repeat}
          onChange={(e) => update("repeat", e.target.value as Repeat)}
        >
          {REPEATS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Location
        <input
          className="bg-gray-200 p-2"
          value={event.location}
          onChange={(e) => update("location", e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        Description
        <textarea
          className="h-24 resize-none bg-gray-200 p-2"
          value={event.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="mt-auto self-center bg-gray-300 px-6 py-2 disabled:opacity-50"
      >
        Create Event
      </button>
    </div>
  );
}