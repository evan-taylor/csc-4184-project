"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import { dateKey, getSelectedDate, getToday, serverSnapshot, subscribeToStorage } from "../calendar-events";
import { loadDraft, readDraft, saveDraft } from "../evening-plan";
import "./page.css";

function PlanEvening() {
  const params = useSearchParams();
  const today = useSyncExternalStore(subscribeToStorage, getToday, serverSnapshot);
  const date = today ? dateKey(getSelectedDate(params.get("date"), today)) : "";
  const draft = useSyncExternalStore(subscribeToStorage, () => readDraft(date), serverSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");

  if (!today) return <main className="planner-page">Loading evening planner…</main>;

  const activities = loadDraft(draft);
  const selectedCount = activities.filter((activity) => activity.selected).length;
  const trimmed = name.trim();
  const duplicate = activities.some((activity) => activity.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <main className="planner-page evening-planner">
      <Link className="calendar-back" href={`/?date=${date}`}>← Back to calendar</Link>
      <h1 className="mb-2 text-2xl font-semibold">Choose activities</h1>
      <p>Pick what you want to do. You’ll set each duration on the next screen.</p>
      <p className="mt-1 text-sm">Have a fixed start time? <Link className="underline" href={`/event/create?date=${date}`}>Add an event</Link>.</p>
      <div className="activity-list">
        {activities.map((activity) => (
          <label className="activity" key={activity.name}>
            <input type="checkbox" checked={activity.selected} onChange={(event) => {
              saveDraft(date, activities.map((item) =>
                item.name === activity.name ? { ...item, selected: event.target.checked } : item));
            }} />
            {activity.name}
          </label>
        ))}
      </div>
      <button className="planner-button" type="button" onClick={() => {
        setName("");
        dialog.current?.showModal();
      }}>+ Add another activity</button>

      <dialog className="popup" ref={dialog} aria-labelledby="add-activity-heading">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed || duplicate) return;
          saveDraft(date, [...activities, { name: trimmed, selected: true, minutes: 30 }]);
          dialog.current?.close();
        }}>
          <h2 className="font-semibold" id="add-activity-heading">Add activity</h2>
          <label className="block" htmlFor="activity-name">Activity name</label>
          <input id="activity-name" value={name} onChange={(event) => setName(event.target.value)} />
          {duplicate && <p className="text-sm text-red-800">That activity is already listed.</p>}
          <button className="planner-button" type="submit" disabled={!trimmed || duplicate}>Add activity</button>
          <button className="planner-button" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
        </form>
      </dialog>

      <p className="mt-5" aria-live="polite">{selectedCount} {selectedCount === 1 ? "activity" : "activities"} selected</p>
      {selectedCount > 0 && (
        <Link className="planner-button w-fit" href={`/add-time?date=${date}`}>Set time →</Link>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="planner-page">Loading evening planner…</main>}>
      <PlanEvening />
    </Suspense>
  );
}
