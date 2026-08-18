import { mkdir, writeFile } from "node:fs/promises";
import { buildCalendar } from "../src/worker.js";

await mkdir("public", { recursive: true });
const calendar = await buildCalendar();
const eventCount = (calendar.match(/BEGIN:VEVENT/g) || []).length;
if (eventCount === 0) {
  throw new Error("No events were discovered; preserving the previous published feed.");
}
await writeFile("public/calendar.ics", calendar, "utf8");
console.log(`Generated ${eventCount} calendar events.`);

