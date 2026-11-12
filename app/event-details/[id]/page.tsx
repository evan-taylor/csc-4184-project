
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

// Load events from localStorage
function loadEvents(): EventDetails[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Find the event that matches the ID in the URL
function getEvent(id: string): EventDetails | undefined {
  return loadEvents().find((e) => e.id === id);
}

// Format time from "09:00" to "9:00 AM"
function formatTime(time: string): string {
  const [hourString, minute] = time.split(":");
  const hour24 = Number(hourString);

  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute} ${period}`;
}

// Format date from YYYY-MM-DD to MM-DD-YY
function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}-${day}-${year.slice(-2)}`;
}

export default function EventDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      const { id } = await params;
      const foundEvent = getEvent(id);

      setEvent(foundEvent ?? null);
      setLoaded(true);
    }

    loadEvent();
  }, [params]);

  // Wait for localStorage event data
  if (!loaded) {
    return null;
  }

  // Event was not found
  if (!event) {
    return (
      <div className="mx-auto w-[360px] p-6">
        <p>Event not found.</p>

        <button
          onClick={() => router.push("/")}
          className="mt-4 bg-gray-300 px-4 py-2"
        >
          Back to Calendar
        </button>
      </div>
    );
  }

  function handleEdit() {
    if (!event) return;

    router.push(`/edit-event/${event.id}`);
  }

  function handleBack() {
    router.back();
  }

  return (
    <div className="mx-auto my-6 min-h-[700px] w-[360px] max-w-full bg-white px-5 py-6 text-black">

      {/* Header */}
      <div className="relative flex items-center">

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <span className="text-4xl font-light">‹</span>
          <span className="text-lg">Back</span>
        </button>

        {/* Date */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-xl">Today</p>
          <p className="text-xl">
            {formatDate(event.date)}
          </p>
        </div>

      </div>

      {/* Event Details heading */}
      <h1 className="mt-10 text-2xl font-bold">
        Event Details
      </h1>

      {/* Event title */}
      <h2 className="mb-4 mt-4 text-xl font-semibold">
        {event.title}
      </h2>

      {/* Event information box */}
      <div className="bg-gray-300 p-3 text-xl">

        {/* Event time */}
        <p>
          <span className="font-bold">Time: </span>
          {formatTime(event.startTime)} to{" "}
          {formatTime(event.endTime)}
        </p>

        {/* Event location */}
        <p className="font-bold">
          Location:
        </p>

        <p className="break-words">
          {event.location || "No location provided"}
        </p>

      </div>

      {/* Edit Event button */}
      <div className="mt-7 flex justify-center">
        <button
          onClick={handleEdit}
          className="bg-gray-300 px-10 py-3 text-xl font-bold"
        >
          Edit Event →
        </button>
      </div>

    </div>
  );
}
