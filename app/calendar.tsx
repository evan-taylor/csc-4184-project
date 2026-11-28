"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useSyncExternalStore } from "react";
import { dateKey, loadEvents, readStoredEvents, seedExampleEvents, type EventDetails } from "./calendar-events";

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

function occursOn(event: EventDetails, date: Date, key: string, excludedDates: string[] = []) {
  // do not display an event on an excluded date
  if(excludedDates.includes(key)) return false;

  if (event.date === key) return true;
  if (event.date > key) return false;

  if (event.repeat === "daily") return true;

  const weekday = date.getDay();
  if (event.repeat === "weekdays") return weekday >= 1 && weekday <= 5;

  return event.repeat === "weekly" && new Date(`${event.date}T12:00:00`).getDay() === weekday;
}

function readStoredExceptions() {
  return localStorage.getItem("eventExceptions");
}

function timeInMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
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

const getToday = () => dateKey(new Date());
const serverSnapshot = () => null;

export default function Calendar() {
  const query = useSearchParams();
  const today = useSyncExternalStore(subscribeToStorage, getToday, serverSnapshot);
  const storedEvents = useSyncExternalStore(subscribeToStorage, readStoredEvents, serverSnapshot);
  const storedExceptions = useSyncExternalStore(subscribeToStorage, readStoredEvents, serverSnapshot);

  useEffect(() => {
    if (today) seedExampleEvents(today);
  }, [today]);

  if (!today) return <main className="planner-page">Loading calendar…</main>;

  // new: function to delete all events on the whole calendar
  function handleDeleteAllEvents() {
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL events on ${selectedKey}?\n` +
      "This will remove events from every calendar date.\n" +
      "This action cannot be undone."
    );

    // cancel was selected
    if (!confirmed) return;

    //const raw = localStorage.getItem("events");

    const events: EventDetails[] = JSON.parse(localStorage.getItem("events") || "[]");

    const exceptions: Record<string, string[]> = JSON.parse(localStorage.getItem("eventExceptions") || "{}");

    // keep only recurring events
    const remainingEvents = events.filter(
      (event) =>
        !(event.date === selectedKey &&
          (event.repeat ?? "none") === "none"
        )
    );

    // record recurring events to hide on this date
    //const exceptionKey = "eventExceptions";
    // const recurringEvents = events.filter(
    //   (event) =>
    //     event.repeat !== "none" &&
    //     occursOn(event, selectedDate, selectedKey)
    // );

    // exclude recurring events only on the selected date
    for (const event of events) {
      if (event.repeat !== "none" && 
        occursOn(event, selectedDate, selectedKey)
      ) {
        const excludedDates = exceptions[event.id] || [];

        if (!excludedDates.includes(selectedKey)) {
          exceptions[event.id] = [...excludedDates, selectedKey];
        }
      }
    }

    localStorage.setItem("events", JSON.stringify(remainingEvents));

    localStorage.setItem("eventExceptions", JSON.stringify(exceptions));

    // notify the calendar that its event data changed
    window.dispatchEvent(new Event ("storage"));
  }

  const selectedDate = getSelectedDate(query.get("date"), today);
  const selectedKey = dateKey(selectedDate);

  let exceptions: Record<string, string[]> = {};

  try {
    exceptions = storedExceptions ? JSON.parse(storedExceptions) : {};
  } catch {
    exceptions = {};
  }

  const heading = selectedKey === today ? "Today" : weekdayFormat.format(selectedDate);
  const events = loadEvents(storedEvents, today)
    .filter((event) => occursOn(event, selectedDate, selectedKey, exceptions[event.id] || []))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const schedule = [];
  let busyUntil = "";
  for (const event of events) {
    const gapStart = busyUntil;
    const gapMinutes = gapStart ? timeInMinutes(event.startTime) - timeInMinutes(gapStart) : 0;
    schedule.push({ event, gapStart, gapMinutes });
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

      {events.length > 0 ? (
        <ol className="planner-agenda" aria-label="Daily schedule">
          {schedule.map(({ event, gapStart, gapMinutes }) => (
            <Fragment key={event.id}>
              {gapMinutes > 0 && (
                <li className="planner-card planner-free-time">
                  <span className="planner-title">Free Time</span>
                  <span className="planner-details">
                    {timeRange(gapStart, event.startTime)} · {freeTimeDuration(gapMinutes)}
                  </span>
                </li>
              )}
              <li>
                <Link
                  className="planner-card planner-event"
                  href={`/event-details/${encodeURIComponent(event.id)}`}
                >
                  <span className="planner-title">{event.title}</span>
                  <Image className="planner-options" src="/calendar/event-options.svg" alt="" width={59} height={16} />
                  <span className="planner-details">{timeRange(event.startTime, event.endTime)}</span>
                  {event.location && <span className="planner-details">{event.location}</span>}
                </Link>
              </li>
            </Fragment>
          ))}
        </ol>
      ) : (
        <p className="planner-empty">No events scheduled for this day.</p>
      )}

      <div className="planner-actions">
       {/* <Link className="planner-button planner-plan" href="/add_activity">+ Plan My Evening</Link>  */}

       <button className="planner-button planner-plan" onClick={() => { sessionStorage.setItem("selectedDate", selectedKey); window.location.href = "/add_activity";}}>
          + Plan My Evening
      </button>

        <div className="planner-links">
          <Link href={`/event/create?date=${selectedKey}`}>Add Event</Link>
          {selectedKey !== today && <Link href="/">Back to today</Link>}
        </div>

        {/* Delete all events */}
        <div className="mt-5 flex justify-center">
          <button type="button" onClick={handleDeleteAllEvents} className="text-base font-semibold text-red-700 underline">
            Delete All Events
          </button>
        </div>


      </div>
    </main>
  );
}
