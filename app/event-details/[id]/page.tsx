"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  dateKey, eventsOnDay, getSelectedDate, getToday, loadEvents, loadExceptions, readStoredEvents,
  readStoredExceptions, saveEvents, timeRange, type EventDetails,
} from "../../calendar-events";
import "../../calendar.css";

const formatDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "short", day: "numeric",
});

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<{ event?: EventDetails; date: string }>();

  useEffect(() => {
    params.then(({ id }) => {
      const today = getToday();
      const events = loadEvents(readStoredEvents(), today);
      const selected = new URLSearchParams(window.location.search).get("date");
      const event = events.find((item) => item.id === id);
      const date = dateKey(getSelectedDate(selected, event?.date ?? today));
      const onCalendar = eventsOnDay(events, date, loadExceptions(readStoredExceptions()));
      setDetails({ date, event: onCalendar.find((item) => item.id === id) });
    });
  }, [params]);

  if (!details) return <main className="planner-page">Loading event…</main>;
  const { event, date } = details;

  if (!event) return (
    <main className="planner-page">
      <p>This event is no longer on the calendar for this day.</p>
      <Link className="underline" href={`/?date=${date}`}>Back to calendar</Link>
    </main>
  );

  const recurring = !!event.repeat && event.repeat !== "none";

  function handleDelete() {
    if (!event) return;
    const events = loadEvents(readStoredEvents(), getToday());
    const exceptions = loadExceptions(readStoredExceptions());
    if (recurring && !exceptions[event.id]?.includes(date)) {
      exceptions[event.id] = [...(exceptions[event.id] ?? []), date];
    }
    saveEvents(recurring ? events : events.filter((item) => item.id !== event.id), exceptions);
    router.replace(`/?date=${date}&status=deleted`);
  }

  return (
    <main className="planner-page">
      <Link className="underline" href={`/?date=${date}`}>← Back to calendar</Link>
      <h1 className="mt-6 text-2xl font-semibold">{event.title}</h1>
      <p className="mb-4">{formatDate.format(new Date(`${date}T12:00:00`))}</p>
      <dl className="space-y-2 rounded-sm bg-[#ffe3e3] p-4">
        <div>
          <dt className="font-semibold">Time</dt>
          <dd>{timeRange(event.startTime, event.endTime)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Location</dt>
          <dd className="break-words">{event.location || "No location provided"}</dd>
        </div>
        {event.description && (
          <div>
            <dt className="font-semibold">Description</dt>
            <dd className="whitespace-pre-wrap break-words">{event.description}</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link className="planner-button" href={`/event/${encodeURIComponent(event.id)}/edit?date=${date}`}>
          {recurring ? "Edit repeating event" : "Edit event"}
        </Link>
        <button className="planner-delete" type="button" onClick={() => dialog.current?.showModal()}>
          {recurring ? "Delete this occurrence" : "Delete event"}
        </button>
      </div>

      <dialog className="planner-popup" ref={dialog} aria-labelledby="delete-heading">
        <div className="planner-dialog-content">
          <h2 id="delete-heading">Delete {event.title}?</h2>
          <p>{recurring ? "Only this occurrence will be removed. The other dates stay on the calendar." : "This removes the event from your calendar."}</p>
          <button className="planner-button" type="button" onClick={() => dialog.current?.close()} autoFocus>Cancel</button>
          <button className="planner-button planner-danger" type="button" onClick={handleDelete}>Delete</button>
        </div>
      </dialog>
    </main>
  );
}
