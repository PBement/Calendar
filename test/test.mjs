import { buildCalendar } from "../src/worker.js";
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(`<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"Test Concert","startDate":"2030-01-02T19:30:00-06:00","endDate":"2030-01-02T21:30:00-06:00","location":{"name":"Test Hall","address":{"streetAddress":"1 Main St","addressLocality":"Minneapolis","addressRegion":"MN"}},"url":"https://example.org/test"}</script>`,{status:200});
const ics=await buildCalendar([["Test Orchestra","https://example.org/events"]]);
for(const s of ["BEGIN:VCALENDAR","SUMMARY:Test Concert — Test Orchestra","LOCATION:Test Hall\\, 1 Main St\\, Minneapolis\\, MN","DTSTART:20300103T013000Z","END:VCALENDAR"]) if(!ics.includes(s)) throw new Error(`missing ${s}`);
globalThis.fetch=oldFetch;
console.log("calendar generation test passed");

