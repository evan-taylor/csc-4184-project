import type { Metadata } from "next";
import { Suspense } from "react";
import Calendar from "./calendar";
import "./calendar.css";

export const metadata: Metadata = {
  title: "Calendar | Planner App",
  description: "View your daily schedule and plan events.",
};

export default function Home() {
  return (
    <Suspense fallback={<main className="planner-page">Loading calendar…</main>}>
      <Calendar />
    </Suspense>
  );
}
