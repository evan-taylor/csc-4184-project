"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  dateKey, eventsOnDay, getSelectedDate, getToday, loadEvents, loadExceptions, minutesToTime,
  readStoredEvents, readStoredExceptions, saveEvents, seedExampleEvents, serverSnapshot,
  subscribeToStorage, timeInMinutes, timeRange, type EventDetails,
} from "./calendar-events";

const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const messages: Record<string, string> = {
  created: "Event added.",
  updated: "Event updated.",
  deleted: "Event deleted.",
  planned: "Evening activities added to the calendar.",
};

function shiftDay(date: Date, offset: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + offset);
  return dateKey(shifted);
}

function freeTimeDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [
    hours && `${hours} ${hours === 1 ? "hour" : "hours"}`,
    remainder && `${remainder} min`,
  ].filter(Boolean).join(" ");
}

function overlaps(first: EventDetails, second: EventDetails) {
  return first.startTime < second.endTime && second.startTime < first.endTime;
}

function swapTimes(first: EventDetails, second: EventDetails) {
  if (second.startTime < first.startTime) [first, second] = [second, first];
  if (overlaps(first, second)) return null;

  const newBoundary = timeInMinutes(first.startTime) + timeInMinutes(second.endTime) - timeInMinutes(second.startTime);
  const gap = timeInMinutes(second.startTime) - timeInMinutes(first.endTime);

  return [
    { ...second, startTime: first.startTime, endTime: minutesToTime(newBoundary) },
    { ...first, startTime: minutesToTime(newBoundary + gap), endTime: second.endTime },
  ];
}

export default function Calendar() {
  const router = useRouter();
  const query = useSearchParams();
  const today = useSyncExternalStore(subscribeToStorage, getToday, serverSnapshot);
  const storedEvents = useSyncExternalStore(subscribeToStorage, readStoredEvents, serverSnapshot);
  const storedExceptions = useSyncExternalStore(subscribeToStorage, readStoredExceptions, serverSnapshot);
  const swapDialog = useRef<HTMLDialogElement>(null);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapError, setSwapError] = useState("");
  const [feedback, setFeedback] = useState<{ date: string; text: string }>();

  useEffect(() => {
    if (today) seedExampleEvents(today);
  }, [today]);

  if (!today) return <main className="planner-page">Loading calendar…</main>;

  const selectedDate = getSelectedDate(query.get("date"), today);
  const selectedKey = dateKey(selectedDate);
  const heading = selectedKey === today ? "Today" : weekdayFormat.format(selectedDate);
  const exceptions = loadExceptions(storedExceptions);
  const events = eventsOnDay(loadEvents(storedEvents, today), selectedKey, exceptions);
  const swapSource = events.find((event) => event.id === swappingId);
  const swapOptions = events.filter((event) => event.id !== swappingId && (!event.repeat || event.repeat === "none"));
  const message = feedback?.date === selectedKey ? feedback.text : messages[query.get("status") ?? ""];

  function handleClear() {
    if (!today) return;
    const all = loadEvents(readStoredEvents(), today);
    const latestExceptions = loadExceptions(readStoredExceptions());
    const visible = eventsOnDay(all, selectedKey, latestExceptions);
    const remove = new Set<string>();
    for (const event of visible) {
      if (!event.repeat || event.repeat === "none") {
        remove.add(event.id);
      } else {
        latestExceptions[event.id] = [...(latestExceptions[event.id] ?? []), selectedKey];
      }
    }
    saveEvents(all.filter((event) => !remove.has(event.id)), latestExceptions);
    clearDialog.current?.close();
    setFeedback({ date: selectedKey, text: "Events cleared for this day." });
  }

  function handleSwap(otherId: string) {
    if (!today || !swappingId) return;
    const all = loadEvents(readStoredEvents(), today);
    const visible = eventsOnDay(all, selectedKey, loadExceptions(readStoredExceptions()));
    const first = visible.find((event) => event.id === swappingId);
    const second = visible.find((event) => event.id === otherId);
    if (!first || !second) {
      setSwapError("Those events changed. Close this dialog and try again.");
      return;
    }
    const swapped = swapTimes(first, second);
    const otherEvents = visible.filter((event) => event.id !== first.id && event.id !== second.id);

    if (!swapped || otherEvents.some((event) => swapped.some((replacement) => overlaps(event, replacement)))) {
      setSwapError("That swap would overlap an event. Pick a different event or edit the times.");
      return;
    }

    saveEvents(all.map((event) => swapped.find((replacement) => replacement.id === event.id) ?? event));
    swapDialog.current?.close();
    setFeedback({ date: selectedKey, text: "Events swapped." });
  }

  const schedule = [];
  let busyUntil = "";
  for (const event of events) {
    const gapStart = busyUntil;
    const gapMinutes = gapStart ? timeInMinutes(event.startTime) - timeInMinutes(gapStart) : 0;
    const conflicts = events
      .filter((other) => other.id !== event.id && overlaps(event, other))
      .map((other) => other.title);
    schedule.push({ event, gapStart, gapMinutes, conflicts });
    if (event.endTime > busyUntil) busyUntil = event.endTime;
  }

  return (
    <main className="planner-page">
      <header className="planner-header">
        <Link className="planner-arrow" href={`/?date=${shiftDay(selectedDate, -1)}`} aria-label="Previous day">
          <Image src="/calendar/previous.svg" alt="" width={36} height={73} />
        </Link>
        <div className="planner-date">
          <h1>{heading}</h1>
          <input type="date" aria-label="Calendar date" value={selectedKey} onChange={(event) => {
            if (event.target.value) router.push(`/?date=${event.target.value}`);
          }} />
        </div>
        <Link className="planner-arrow" href={`/?date=${shiftDay(selectedDate, 1)}`} aria-label="Next day">
          <Image src="/calendar/next.svg" alt="" width={36} height={73} />
        </Link>
      </header>

      <div role="status">{message && <p className="planner-status">{message}</p>}</div>
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
                <Link className="planner-card planner-event"
                  href={`/event-details/${encodeURIComponent(event.id)}?date=${selectedKey}`}>
                  <span className="planner-title">{event.title}</span>
                  <span className="planner-details">{timeRange(event.startTime, event.endTime)}</span>
                  {event.location && <span className="planner-details">{event.location}</span>}
                  {conflicts.length > 0 && (
                    <span className="planner-details planner-conflict">Overlaps with {conflicts.join(", ")}</span>
                  )}
                </Link>
                {(!event.repeat || event.repeat === "none") && (
                  <button type="button" className="planner-swap-button" aria-label={`Swap ${event.title}`} onClick={() => {
                    setSwappingId(event.id);
                    setSwapError("");
                    swapDialog.current?.showModal();
                  }}>⇅ Swap</button>
                )}
              </li>
            </Fragment>
          ))}
        </ol>
      ) : <p className="planner-empty">No events scheduled for this day.</p>}

      <div className="planner-actions">
        <Link className="planner-button planner-plan" href={`/add_activity?date=${selectedKey}`}>+ Plan My Evening</Link>
        <div className="planner-links">
          <Link href={`/event/create?date=${selectedKey}`}>Add Event</Link>
          {selectedKey !== today && <Link href="/">Back to today</Link>}
        </div>
        {events.length > 0 && (
          <button type="button" className="planner-delete" onClick={() => clearDialog.current?.showModal()}>
            Clear this day
          </button>
        )}
      </div>

      <dialog className="planner-popup" ref={swapDialog} aria-labelledby="swap-heading">
        <div className="planner-dialog-content">
          <h2 id="swap-heading">Swap {swapSource?.title}</h2>
          {swapOptions.length > 0 ? swapOptions.map((event) => (
            <button type="button" key={event.id} className="planner-button" onClick={() => handleSwap(event.id)}>
              {event.title} · {timeRange(event.startTime, event.endTime)}
            </button>
          )) : <p>No other one-time events are available to swap on this day.</p>}
          {swapError && <p role="alert" className="planner-conflict">{swapError}</p>}
          <button type="button" className="planner-button" onClick={() => swapDialog.current?.close()}>Cancel</button>
        </div>
      </dialog>

      <dialog className="planner-popup" ref={clearDialog} aria-labelledby="clear-heading">
        <div className="planner-dialog-content">
          <h2 id="clear-heading">Clear {dateFormat.format(selectedDate)}?</h2>
          <p>This removes all {events.length} {events.length === 1 ? "event" : "events"} from this day. Events on other dates stay on the calendar.</p>
          <button type="button" className="planner-button" onClick={() => clearDialog.current?.close()} autoFocus>Cancel</button>
          <button type="button" className="planner-button planner-danger" onClick={handleClear}>Clear this day</button>
        </div>
      </dialog>
    </main>
  );
}
