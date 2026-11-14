"use client";

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation";

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
    events[index] = event;
  } else {
    events.push(event);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function getEvent(id: string): EventDetails | undefined {
  return loadEvents().find((e) => e.id === id);
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

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
          className="w-16 min-w-0 rounded-xs bg-gray-100 py-2 pl-2.5 pr-1"
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
          className="w-16 min-w-0 rounded-xs bg-gray-100 py-2 pl-2.5 pr-1"
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
          className="w-16 min-w-0 rounded-xs bg-gray-100 py-2 pl-2.5 pr-1"
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

export default function EditEventPage({ params }: { params: any }) {
  const router = useRouter();

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Read the id directly from the params prop instead
    Promise.resolve(params).then((resolvedParams) => {
      setEvent(getEvent(resolvedParams.id) ?? null);
      setLoaded(true);
    });
  }, [params]);

  function update<K extends keyof EventDetails>(field: K, value: EventDetails[K]) {
    setEvent((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  const timeError =
    event && event.endTime <= event.startTime
      ? "End time must be after the start time."
      : "";
  const canSave =
    !!event && event.title.trim() !== "" && event.date !== "" && !timeError;

  function handleSave() {
    if (!event || !canSave) return;
    saveEvent(event);
    router.push("/");
  }

  if (!loaded) return null;
  if (!event) return <p className="planner-page">Event not found.</p>;

  return (
    <div className="planner-page flex flex-col gap-4">
      <button
        onClick={() => router.back()}
        className="planner-button self-end"
        aria-label="Close"
      >
        Close
      </button>

      <label className="flex flex-col gap-1">
        Event Title
        <input
          className="min-w-0 rounded-xs bg-gray-100 p-2"
          value={event.title}
          onChange={(e) => update("title", e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        Date
        <input
          type="date"
          className="min-w-0 rounded-xs bg-gray-100 p-2"
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
          className="min-w-0 rounded-xs bg-gray-100 p-2"
          value={event.repeat ?? "none"}
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
          className="min-w-0 rounded-xs bg-gray-100 p-2"
          value={event.location}
          onChange={(e) => update("location", e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        Description
        <textarea
          className="h-24 resize-none min-w-0 rounded-xs bg-gray-100 p-2"
          value={event.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className="planner-button self-center disabled:opacity-50"
      >
        Save Changes
      </button>
    </div>
    
  );
}