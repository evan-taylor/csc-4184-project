"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useSyncExternalStore } from "react";
import {
  dateKey, eventsOnDay, getSelectedDate, getToday, loadEvents, loadExceptions, minutesToTime,
  readStoredEvents, readStoredExceptions, saveEvents, serverSnapshot, subscribeToStorage, timeRange,
} from "../calendar-events";
import { arrangeActivities, clearDraft, eveningSlots, loadDraft, readDraft, saveDraft } from "../evening-plan";
import "./page.css";

function SetTime() {
  const router = useRouter();
  const params = useSearchParams();
  const today = useSyncExternalStore(subscribeToStorage, getToday, serverSnapshot);
  const date = today ? dateKey(getSelectedDate(params.get("date"), today)) : "";
  const draft = useSyncExternalStore(subscribeToStorage, () => readDraft(date), serverSnapshot);
  const stored = useSyncExternalStore(subscribeToStorage, readStoredEvents, serverSnapshot);
  const exceptions = useSyncExternalStore(subscribeToStorage, readStoredExceptions, serverSnapshot);
  const [saveError, setSaveError] = useState("");

  if (!today) return <main className="planner-page">Loading evening planner…</main>;

  const allActivities = loadDraft(draft);
  const activities = allActivities.filter((activity) => activity.selected);
  const slots = eveningSlots(eventsOnDay(loadEvents(stored, today), date, loadExceptions(exceptions)));
  const available = slots.reduce((sum, slot) => sum + slot.end - slot.start, 0);
  const planned = activities.reduce((sum, activity) => sum + activity.minutes, 0);
  const valid = activities.length > 0 && activities.every((activity) => activity.minutes > 0);
  const plan = valid ? arrangeActivities(activities, slots) : null;
  const issue = !activities.length
    ? "Go back and choose at least one activity."
    : !valid
      ? "Give each selected activity at least one minute."
      : planned > available
        ? `Shorten your activities by at least ${planned - available} min.`
        : !plan ? "The activities do not fit in the available gaps. Try a shorter duration." : "";

  function changeTime(name: string, minutes: number) {
    setSaveError("");
    const next = Math.max(0, Math.min(24 * 60, Math.floor(minutes)));
    saveDraft(date, allActivities.map((activity) => activity.name === name ? { ...activity, minutes: next } : activity));
  }

  function savePlan() {
    if (!today || !plan) return;
    const events = loadEvents(readStoredEvents(), today);
    const latestSlots = eveningSlots(eventsOnDay(events, date, loadExceptions(readStoredExceptions())));
    const updatedPlan = arrangeActivities(activities, latestSlots);
    if (!updatedPlan) {
      setSaveError("The calendar changed. Adjust the durations to fit the latest gaps.");
      return;
    }

    saveEvents([...events, ...updatedPlan.map(({ name, start, end }) => ({
      id: crypto.randomUUID(),
      date,
      title: name,
      startTime: start,
      endTime: end,
      location: "",
      description: "",
      repeat: "none" as const,
    }))]);
    clearDraft(date);
    router.push(`/?date=${date}&status=planned`);
  }

  return (
    <main className="planner-page set-time">
      <Link className="calendar-back" href={`/add_activity?date=${date}`}>← Choose activities</Link>
      <h1 className="mb-2 text-2xl font-semibold">Set activity durations</h1>
      <p className="font-semibold">{available} min available this evening</p>
      <p className="text-sm">The planner checks openings after 4:00 PM until Bedtime or 10:00 PM.</p>
      <p className="text-sm">
        {slots.length
          ? slots.map((slot) => timeRange(minutesToTime(slot.start), minutesToTime(slot.end))).join(" · ")
          : "There are no open time slots before bedtime."}
      </p>

      <div className="activity-list">
        {activities.map((activity) => (
          <div className="activity" key={activity.name}>
            <h2>{activity.name}</h2>
            <div className="time-controls">
              <button type="button" aria-label={`Subtract 5 minutes from ${activity.name}`}
                onClick={() => changeTime(activity.name, activity.minutes - 5)}>−</button>
              <input type="number" min="0" max="1440" step="1" aria-label={`${activity.name} duration in minutes`}
                value={activity.minutes} onChange={(event) => changeTime(activity.name, Number(event.target.value))} />
              <span>min</span>
              <button type="button" aria-label={`Add 5 minutes to ${activity.name}`}
                onClick={() => changeTime(activity.name, activity.minutes + 5)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="time-summary" aria-live="polite">
        <p>{planned} min planned · {Math.max(0, available - planned)} min remaining</p>
        {issue && <p className="text-red-800">{issue}</p>}
        {saveError && <p className="text-red-800">{saveError}</p>}
      </div>

      {plan && (
        <section className="mt-4" aria-label="Schedule preview">
          <h2 className="font-semibold">Schedule preview</h2>
          <ul className="mt-1">
            {plan.map((item) => (
              <li key={item.name}>{item.name} · {timeRange(item.start, item.end)}</li>
            ))}
          </ul>
        </section>
      )}
      <button className="planner-button" type="button" disabled={!plan} onClick={savePlan}>Arrange Evening</button>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="planner-page">Loading evening planner…</main>}>
      <SetTime />
    </Suspense>
  );
}
