"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { dateKey, loadEvents, readStoredEvents, seedExampleEvents, occursOn, loadExceptions, readStoredExceptions, timeInMinutes, type EventDetails } from "./calendar-events";

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function shiftDay(date: Date, offset: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + offset);
  return dateKey(shifted);
}

function getSelectedDate(value: string | null, today: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    if (dateKey(date) === value) return date;
  }
  return new Date(`${today}T12:00:00`);
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function timeRange(start: string, end: string) {
  const format = (time: string) => timeFormat.format(new Date(`2000-01-01T${time}:00`));
  return `${format(start)} – ${format(end)}`;
}

function freeTimeDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [
    hours && `${hours} ${hours === 1 ? "hour" : "hours"}`,
    remainder && `${remainder} min`,
  ].filter(Boolean).join(" ");
}

function subscribeToStorage(notify: () => void) {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

function overlaps(a: EventDetails, b: EventDetails) {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function swapEvents(all: EventDetails[], idA: string, idB: string) {
  const a = all.find((e) => e.id === idA);
  const b = all.find((e) => e.id === idB);
  if (!a || !b || overlaps(a, b)) return null;

  const [first, second] = a.startTime <= b.startTime ? [a, b] : [b, a];

  const firstLength = timeInMinutes(first.endTime) - timeInMinutes(first.startTime);
  const secondLength = timeInMinutes(second.endTime) - timeInMinutes(second.startTime);
  const gap = Math.max(0, timeInMinutes(second.startTime) - timeInMinutes(first.endTime));

  const secondStart = timeInMinutes(first.startTime);
  const secondEnd = secondStart + secondLength;

  const firstStart = secondEnd + gap;
  const firstEnd = firstStart + firstLength;

  if (firstEnd >= 24 * 60) return null;

  return all.map((e) => {
    if (e.id === second.id) {
      return { ...e, startTime: minutesToTime(secondStart), endTime: minutesToTime(secondEnd) };
    }
    if (e.id === first.id) {
      return { ...e, startTime: minutesToTime(firstStart), endTime: minutesToTime(firstEnd) };
    }
    return e;
  });
}

const getToday = () => dateKey(new Date());
const serverSnapshot = () => null;

export default function Calendar() {
  const router = useRouter();
  const query = useSearchParams();
  const today = useSyncExternalStore(subscribeToStorage, getToday, serverSnapshot);
  const storedEvents = useSyncExternalStore(subscribeToStorage, readStoredEvents, serverSnapshot);
  const storedExceptions = useSyncExternalStore(subscribeToStorage, readStoredExceptions, serverSnapshot);

  const [swappingId, setSwappingId] = useState<string | null>(null);

  useEffect(() => {
    if (today) seedExampleEvents(today);
  }, [today]);

  if (!today) return <main className="planner-page">Loading calendar…</main>;

  function handleDeleteAllEvents() {
    if (!window.confirm(`Clear all events on ${dateFormat.format(selectedDate)}? Events on other dates will stay on the calendar.`) || !today) return;

    const all = loadEvents(readStoredEvents(), today);
    const latestExceptions = loadExceptions(readStoredExceptions());
    const visible = all.filter((event) => occursOn(event, selectedDate, selectedKey, latestExceptions[event.id]));
    const remove = new Set<string>();

    for (const event of visible) {
      if (!event.repeat || event.repeat === "none") {
        remove.add(event.id);
      } else {
        latestExceptions[event.id] = [...(latestExceptions[event.id] ?? []), selectedKey];
      }
    }

    localStorage.setItem("events", JSON.stringify(all.filter((event) => !remove.has(event.id))));
    localStorage.setItem("eventExceptions", JSON.stringify(latestExceptions));
    window.dispatchEvent(new Event("storage"));
  }

  const selectedDate = getSelectedDate(query.get("date"), today);
  const selectedKey = dateKey(selectedDate);

  const exceptions = loadExceptions(storedExceptions);

  const heading = selectedKey === today ? "Today" : weekdayFormat.format(selectedDate);
  const events = loadEvents(storedEvents, today)
    .filter((event) => occursOn(event, selectedDate, selectedKey, exceptions[event.id] || []))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleSwap = (otherId: string) => {
    if (!swappingId) return;

    const updated = swapEvents(loadEvents(storedEvents, today), swappingId, otherId);

    const otherEvents = events.filter((event) => event.id !== swappingId && event.id !== otherId);
    const swapped = updated?.filter((event) => event.id === swappingId || event.id === otherId);
    if (updated && !swapped?.some((event) => otherEvents.some((other) => overlaps(event, other)))) {
      localStorage.setItem("events", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } else {
      alert("That swap would cause an overlap. Try another event or edit the times.");
    }
    setSwappingId(null);
  };

  const swapOptions = events.filter((event) => event.id !== swappingId && (!event.repeat || event.repeat === "none"));

  const statusMessages = new Map([
    ["created", "Event added."],
    ["updated", "Event updated."],
    ["deleted", "Event deleted."],
    ["planned", "Evening activities added to the calendar."],
  ]);
  const message = statusMessages.get(query.get("status") ?? "");
  const schedule = [];
  let busyUntil = "";
  for (const event of events) {
    const gapStart = busyUntil;
    const gapMinutes = gapStart ? timeInMinutes(event.startTime) - timeInMinutes(gapStart) : 0;
    const conflicts = events.filter((other) => other.id !== event.id && overlaps(event, other));
    schedule.push({ event, gapStart, gapMinutes, conflicts });
    if (event.endTime > busyUntil) busyUntil = event.endTime;
  }

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="planner-arrow" href={`/?date=${shiftDay(selectedDate, -1)}`} aria-label="Previous day">
          <Image src="/calendar/previous.svg" alt="" width={36} height={73} />
        </Link>
        <div className="planner-date" aria-live="polite">
          <h1>{heading}</h1>
          <time dateTime={selectedKey}>{dateFormat.format(selectedDate)}</time>
        </div>
        <Link className="planner-arrow" href={`/?date=${shiftDay(selectedDate, 1)}`} aria-label="Next day">
          <Image src="/calendar/next.svg" alt="" width={36} height={73} />
        </Link>
      </header>

      {message && <p className="mb-3 rounded bg-green-50 p-2 text-green-900" role="status">{message}</p>}

      {events.length > 0 ? (
        <ol className="planner-agenda" aria-label="Daily schedule">
          {schedule.map(({ event, gapStart, gapMinutes, conflicts }) => (
            <Fragment key={event.id}>
              {gapMinutes > 0 && (
                <li className="planner-card planner-free-time">
                  <span className="planner-title">Free Time</span>
                  <span className="planner-details">
                    {timeRange(gapStart, event.startTime)} · {freeTimeDuration(gapMinutes)}
                  </span>
                </li>
              )}
              <li className="planner-event-row">
                <Link
                  className="planner-card planner-event"
                  href={`/event-details/${encodeURIComponent(event.id)}?date=${selectedKey}`}
                >
                  <span className="planner-title">{event.title}</span>
                  <span className="planner-details">{timeRange(event.startTime, event.endTime)}</span>
                  {event.location && <span className="planner-details">{event.location}</span>}
                  {conflicts.length > 0 && (
                    <span className="planner-details font-semibold text-red-800">
                      Overlaps with {conflicts.map((other) => other.title).join(", ")}
                    </span>
                  )}
                </Link>

                {(!event.repeat || event.repeat === "none") && <button
                  className="planner-swap-button"
                  aria-label={`Swap ${event.title}`}
                  onClick={() => setSwappingId(event.id)}
                >
                  ⇅ Swap
                </button>}
              </li>
            </Fragment>
          ))}
        </ol>
      ) : (
        <p className="planner-empty">No events scheduled for this day.</p>
      )}

      <div className="planner-actions">
        <button className="planner-button planner-plan" onClick={() => {
          sessionStorage.setItem("selectedDate", selectedKey);
          router.push(`/add_activity?date=${selectedKey}`);
        }}>
          + Plan My Evening
        </button>

        <div className="planner-links">
          <Link href={`/event/create?date=${selectedKey}`}>Add Event</Link>
          {selectedKey !== today && <Link href="/">Back to today</Link>}
        </div>

        {events.length > 0 && (
          <button type="button" onClick={handleDeleteAllEvents} className="mt-5 text-base font-semibold text-red-700 underline">
            Clear this day
          </button>
        )}
      </div>
      {swappingId && (
        <div className="planner-popup-background" onClick={() => setSwappingId(null)}>
          <div
            className="planner-popup"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {swapOptions.length > 0 ? (
              <>
                <h2>What event would you like to swap with?</h2>
                {swapOptions.map((event) => (
                  <button
                    key={event.id}
                    className="planner-button"
                    onClick={() => handleSwap(event.id)}
                  >
                    {event.title} ({timeRange(event.startTime, event.endTime)})
                  </button>
                ))}
                <button className="planner-button" onClick={() => setSwappingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2>No events to swap with</h2>
                <button className="planner-button" onClick={() => setSwappingId(null)}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
