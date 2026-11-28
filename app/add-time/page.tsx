"use client";

import "./page.css";
import { useState, useEffect, act } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { readStoredEvents, loadEvents } from "../calendar-events";
import type { EventDetails } from "../calendar-events";

type Activity = {
    name: string;
    time: number;
};


function AvailableTime(events: EventDetails[], date: string) {
    const freeEvent = FindFreeTime(events, date);

    if (!freeEvent) {
        return 0;
    }

    const start = HoursToMin(freeEvent.startTime);
    const end = HoursToMin(freeEvent.endTime);

    return Math.max(0, end - start);
}

function FindFreeTime(events: EventDetails[], date: string) {
    return events
        .filter(event =>
            event.date === date &&
            event.title === "Free Time"
        )
        .filter(event =>
            HoursToMin(event.endTime) > HoursToMin(event.startTime)
        )
        .sort((a, b) =>
            HoursToMin(a.startTime) - HoursToMin(b.startTime)
        )[0];
}

function SaveActivities(activities: Activity[], date: string) {
    const stored = readStoredEvents();
    const events = loadEvents(stored, date);

    const freeEvent = FindFreeTime(events, date);

    if(!freeEvent){
        alert("No event named Free Time found");
        return false;
    }

    let start = HoursToMin(freeEvent.startTime);
    let end = HoursToMin(freeEvent.endTime);

    const availabeTime = end - start;
    
    const plannedTime = activities.reduce((total, activity) => total + activity.time, 0);

    if (plannedTime > availabeTime){
        const decrease = plannedTime - availabeTime;
        
        alert(`Not enought free time. Decrese by ${decrease} minutes`);
        return false;
    }
    const newEvents: EventDetails[] = [];

    for (const activity of activities) {

        if (activity.time <= 0){
            continue;
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

    const storedEvents: EventDetails[] = stored ? JSON.parse(stored) : [];

    const updatedEvents = storedEvents.filter(
        event => event.id !== freeEvent.id
    );

    if (start < end) {
        updatedEvents.push({
            ...freeEvent,
            startTime: MinToHour(start)
        });
    }


    localStorage.setItem(
        "events",
        JSON.stringify([...updatedEvents, ...newEvents])
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

    const remainingTime = Math.max(0, freeTime - plannedTime);

    const decrease = Math.max(0, plannedTime - freeTime);

    function ChangeTime(i: number, amount: number) {
        
        if (!Number.isFinite(amount)){
            return;
        }

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

                            <input 
                                type = "number" 
                                min = "0" 
                                value = {activity.time} 
                                onChange={(e) => ChangeTime(index, Number(e.target.value) - activity.time)}>

                            </input>

                            <span> min</span>

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

                {decrease > 0 && (
                    <p style={{ color: "red" }}>
                        Not enough free time. Decrease by {decrease} minutes.
                    </p>
                )}
    
            </div>

            <button className="planner-button" onClick={() => ArrangeEvening(activities, router)}>
                Arrange Evening →
            </button>
        </main>
    );
}
