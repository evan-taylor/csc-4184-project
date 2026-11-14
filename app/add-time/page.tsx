"use client";

import "./page.css";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { readStoredEvents, loadEvents } from "../calendar-events";
import type { EventDetails } from "../calendar-events";

type Activity = {
    name: string;
    time: number;
};


function AvailableTime(events: EventDetails[], date: string) {
    const Start = 0 ;
    const End = 24 * 60; 

    const busy = events.filter(event => event.date === date).map(event => ({
            start: Math.max(Start, HoursToMin(event.startTime)),
            end: Math.min(End, HoursToMin(event.endTime))
        }))
        .filter(event => event.end > event.start)
        .sort((a, b) => a.start - b.start);

    let busyMinutes = 0;
    let lastEnd = Start;

    for (const event of busy) {
        const start = Math.max(event.start, lastEnd);

        if (event.end > start) {
            busyMinutes += event.end - start;
        }

        lastEnd = Math.max(lastEnd, event.end);
    }

    return End - Start - busyMinutes;
}



function SaveActivities(activities: Activity[], date: string) {
    const stored = readStoredEvents();
    const events = loadEvents(stored, date);

    const Start = 0 * 60 ;
    const End = 24 * 60;

    const busy = events
        .filter(event => event.date === date)
        .map(event => ({
            start: HoursToMin(event.startTime),
            end: HoursToMin(event.endTime)
        }))
        .sort((a, b) => a.start - b.start);

    let start = Start;
    const newEvents: EventDetails[] = [];

    for (const activity of activities) {

        for (const event of busy) {
            if (start + activity.time <= event.start) {
                break;
            }

            if (start < event.end && start + activity.time > event.start) {
                start = event.end;
            }
        }

        if (start + activity.time > End) {
            const t = start + activity.time - End;
            alert(`Not enough free time. Decrease by ${t} minutes`);
            return false;
        }

        newEvents.push({
            id: crypto.randomUUID(),
            date,
            title: activity.name,
            startTime: MinToHour(start),
            endTime: MinToHour(start + activity.time),
            location: "",
            description: "",
            repeat: "none"
        });

        start += activity.time;
    }

    localStorage.setItem(
        "events",
        JSON.stringify([...events, ...newEvents])
    );

    return true;
}

function ArrangeEvening(activities:Activity[], router: ReturnType<typeof useRouter>) {
    const selectedDate = sessionStorage.getItem("selectedDate");

    if (selectedDate) {
        const saved = SaveActivities(activities, selectedDate);
        
        if (saved){
            router.push(`/?date=${selectedDate}`);
        }
    }
}


function MinToHour(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function HoursToMin(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}



export default function SetTime() {

    const [activities, setActivities] = useState<Activity[]>([]);

    const[freeTime, setFreeTime] = useState(0);

    const router = useRouter();

    useEffect(() => {

        const selectedDate = sessionStorage.getItem("selectedDate");

        if (selectedDate) {
            const stored = readStoredEvents();
            const events = loadEvents(stored, selectedDate);

            setFreeTime(AvailableTime(events, selectedDate));
        }

        const saved = sessionStorage.getItem("selectedActivities");

        if (saved) {
            const selected = JSON.parse(saved);

            setActivities(selected.map((activity: { name: string }) => {
                return {name: activity.name, time: 30};
            }));
        }
    }, []);



    const plannedTime = activities.reduce((total, activity) => total + activity.time, 0);

    const remainingTime = freeTime - plannedTime;

    function ChangeTime(i: number, amount: number) {
        setActivities(prev => prev.map((activity, j) => {
            if (j === i) {
                return {...activity, time: Math.max(0, activity.time + amount)};
            }
            return activity;
        }));
    }

    return (
        <main className="planner-page set-time">
            <Link className="calendar-back" href="/add_activity">
                Back
            </Link>

            <div className="subtitle">
                <h2>How Long?</h2>
            </div>

            <p>Available Time: {Math.floor(freeTime / 60)} hr {freeTime % 60} min </p>

            <div className="activity-list">
                {activities.map((activity, index) => (
                    <div className="activity" key={index}>
                        <h2>{activity.name}</h2>

                        <div className="time-controls">
                            <button onClick={() => ChangeTime(index, -5)}>
                                -
                            </button>

                            <span>{activity.time} min</span>

                            <button onClick={() => ChangeTime(index, 5)}>
                                +
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="time-summary">
                <p>
                    Planned: {Math.floor(plannedTime / 60)} hr {plannedTime % 60} min
                </p>

                <p>
                    Remaining Free Time: {remainingTime} min
                </p>
            </div>

            <button className="planner-button" onClick={() => ArrangeEvening(activities, router)}>
                Arrange Evening →
            </button>
        </main>
    );
}
