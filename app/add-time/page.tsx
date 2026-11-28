"use client";

import "./page.css";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { dateKey, loadEvents, loadExceptions, occursOn, readStoredEvents, readStoredExceptions, timeInMinutes } from "../calendar-events";
import type { EventDetails } from "../calendar-events";

type Activity = {
    name: string;
    time: number;
};


function findEveningGaps(events: EventDetails[], date: string) {
    const exceptions = loadExceptions(readStoredExceptions());
    const selectedDay = new Date(`${date}T12:00:00`);
    const agenda = events.filter(event => occursOn(event, selectedDay, date, exceptions[event.id]))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const bedtime = agenda.find(event => event.title.trim().toLowerCase() === "bedtime");
    const cutoff = timeInMinutes(bedtime?.startTime ?? "22:00");
    const gaps: { start: number; end: number }[] = [];
    let start = timeInMinutes("16:00");

    for (const event of agenda) {
        const busyStart = timeInMinutes(event.startTime);
        if (busyStart >= cutoff) break;
        if (busyStart > start) gaps.push({ start, end: busyStart });
        start = Math.max(start, timeInMinutes(event.endTime));
    }
    if (start < cutoff) gaps.push({ start, end: cutoff });
    return gaps;
}

function arrangeActivities(activities: Activity[], gaps: ReturnType<typeof findEveningGaps>) {
    const ordered = [...activities].sort((a, b) => b.time - a.time);
    const plan: { name: string; start: number; end: number }[] = [];

    // Try another gap if the first choice leaves a later activity without room.
    function place(index: number): boolean {
        if (index === ordered.length) return true;
        const activity = ordered[index];
        for (const gap of gaps) {
            if (gap.end - gap.start < activity.time) continue;
            const start = gap.start;
            gap.start += activity.time;
            plan.push({ name: activity.name, start, end: gap.start });
            if (place(index + 1)) return true;
            gap.start = start;
            plan.pop();
        }
        return false;
    }

    return place(0) ? plan.sort((a, b) => a.start - b.start) : null;
}

function formatTime(minutes: number) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
        .format(new Date(`2000-01-01T${MinToHour(minutes)}:00`));
}

function MinToHour(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function SetTimeForm({ date }: { date: string }) {
    const router = useRouter();
    const [activities, setActivities] = useState<Activity[]>(() =>
        JSON.parse(sessionStorage.getItem("selectedActivities") ?? "[]")
            .map((activity: { name: string }) => ({ name: activity.name, time: 30 }))
    );
    const [saveError, setSaveError] = useState("");
    const today = dateKey(new Date());
    const gaps = findEveningGaps(loadEvents(readStoredEvents(), today), date);
    const freeTime = gaps.reduce((total, gap) => total + gap.end - gap.start, 0);
    const plannedTime = activities.reduce((total, activity) => total + activity.time, 0);
    const remainingTime = Math.max(0, freeTime - plannedTime);
    const decrease = Math.max(0, plannedTime - freeTime);
    const hasZero = activities.some(activity => activity.time === 0);
    const plan = activities.length && !hasZero && !decrease ? arrangeActivities(activities, gaps) : null;

    function savePlan() {
        if (!plan) return;
        const events = loadEvents(readStoredEvents(), today);
        const latestPlan = arrangeActivities(activities, findEveningGaps(events, date));
        if (!latestPlan) {
            setSaveError("The calendar changed. Adjust your durations and try again.");
            return;
        }
        const newEvents: EventDetails[] = latestPlan.map(activity => ({
            id: crypto.randomUUID(),
            date,
            title: activity.name,
            startTime: MinToHour(activity.start),
            endTime: MinToHour(activity.end),
            location: "",
            description: "",
            repeat: "none",
        }));
        localStorage.setItem("events", JSON.stringify([...events, ...newEvents]));
        sessionStorage.removeItem("selectedActivities");
        window.dispatchEvent(new Event("storage"));
        router.push(`/?date=${date}&status=planned`);
    }

    function ChangeTime(i: number, amount: number) {

        if (!Number.isFinite(amount)){
            return;
        }

        setSaveError("");
        setActivities(prev => prev.map((activity, j) => {
            if (j === i) {
                return {...activity, time: Math.max(0, Math.floor(activity.time + amount))};
            }
            return activity;
        }));
    }

    return (
        <main className="planner-page set-time">
            <Link className="calendar-back" href={`/add_activity?date=${date}`}>
                Back
            </Link>

            <div className="subtitle">
                <h2>How Long?</h2>
            </div>

            <p>Available Time: {Math.floor(freeTime / 60)} hr {freeTime % 60} min </p>
            <p className="text-sm">Openings from 4 PM until Bedtime, or 10 PM if there’s no Bedtime event.</p>
            <Link className="text-sm underline" href={`/event/create?date=${date}`}>Add an event with a fixed time</Link>

            <div className="activity-list">
                {activities.map((activity, index) => (
                    <div className="activity" key={index}>
                        <h2>{activity.name}</h2>

                        <div className="time-controls">
                            <button aria-label={`Subtract 5 minutes from ${activity.name}`} onClick={() => ChangeTime(index, -5)}>
                                -
                            </button>

                            <input
                                type = "number"
                                min="0"
                                aria-label={`${activity.name} duration in minutes`}
                                value = {activity.time}
                                onChange={(e) => ChangeTime(index, Number(e.target.value) - activity.time)}>

                            </input>

                            <span> min</span>

                            <button aria-label={`Add 5 minutes to ${activity.name}`} onClick={() => ChangeTime(index, 5)}>
                                +
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="time-summary" aria-live="polite">
                <p>Planned: {Math.floor(plannedTime / 60)} hr {plannedTime % 60} min</p>
                <p>Remaining Free Time: {remainingTime} min</p>
                {hasZero && <p className="text-red-800">Give each activity at least one minute.</p>}
                {decrease > 0 && <p className="text-red-800">Not enough free time. Shorten by {decrease} minutes.</p>}
                {!hasZero && !decrease && !plan && activities.length > 0 && (
                    <p className="text-red-800">An activity doesn’t fit in the open times. Try a shorter duration.</p>
                )}
                {saveError && <p className="text-red-800">{saveError}</p>}
            </div>

            {plan && (
                <div className="mt-4">
                    <h2 className="font-semibold">Schedule preview</h2>
                    <ul>
                        {plan.map((item) => (
                            <li key={item.start}>{item.name} · {formatTime(item.start)} – {formatTime(item.end)}</li>
                        ))}
                    </ul>
                </div>
            )}
            <button className="planner-button disabled:opacity-50" disabled={!plan} onClick={savePlan}>
                Arrange Evening →
            </button>
        </main>
    );
}

const subscribe = () => () => {};
const getSelectedDate = () => sessionStorage.getItem("selectedDate") ?? dateKey(new Date());

export default function SetTime() {
    const date = useSyncExternalStore(subscribe, getSelectedDate, () => null);
    return date ? <SetTimeForm date={date} /> : <main className="planner-page">Loading evening planner…</main>;
}
