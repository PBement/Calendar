const SOURCES = [
  ["Minnesota Orchestra", "https://www.minnesotaorchestra.org/tickets/calendar/"],
  ["The Saint Paul Chamber Orchestra", "https://content.thespco.org/events/"],
  ["Guthrie Theater", "https://www.guthrietheater.org/whats-on/calendar/"],
  ["Minnesota Opera", "https://mnopera.org/upcoming-events/"],
  ["Ordway Center", "https://ordway.org/events/"],
  ["Hennepin Arts", "https://hennepinarts.org/events"],
  ["Children's Theatre Company", "https://childrenstheatre.org/whats-on/"],
  ["Northrop", "https://www.northrop.umn.edu/events"],
  ["Walker Art Center", "https://walkerart.org/calendar"],
  ["The Schubert Club", "https://schubert.org/events/"],
  ["VocalEssence", "https://www.vocalessence.org/events/"],
  ["Theater Latté Da", "https://www.latteda.org/performances"],
  ["Jungle Theater", "https://www.jungletheater.org/shows"],
  ["Penumbra Theatre", "https://penumbratheatre.org/events/"],
  ["History Theatre", "https://historytheatre.com/whats-on/"],
  ["Mixed Blood Theatre", "https://mixedblood.com/events/"],
  ["Park Square Theatre", "https://parksquaretheatre.org/whats-on/"],
  ["Open Eye Theatre", "https://www.openeyetheatre.org/calendar"],
  ["Illusion Theater", "https://www.illusiontheater.org/events"],
  ["Yellow Tree Theatre", "https://yellowtreetheatre.com/shows/"],
  ["Ten Thousand Things", "https://tenthousandthings.org/shows/"],
  ["Minnesota Fringe", "https://minnesotafringe.org/calendar"],
  ["Minnesota Dance Theatre", "https://mndance.org/performances/"],
  ["TU Dance", "https://www.tudance.org/performances"],
  ["James Sewell Ballet", "https://jsballet.org/performances/"],
  ["Chanhassen Dinner Theatres", "https://chanhassendt.com/shows/"],
  ["Bloomington Center for the Arts", "https://www.bloomingtonmn.gov/arts/events"],
  ["Pantages, Orpheum & State Theatres", "https://hennepinarts.org/events"]
];

const enc = new TextEncoder();
const esc = s => String(s ?? "").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
const text = s => String(s ?? "").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const fold = line => {
  const out=[]; let part="";
  for (const ch of line) {
    if (enc.encode(part+ch).length > 73) { out.push(part); part=" "+ch; } else part+=ch;
  }
  out.push(part); return out.join("\r\n");
};
const hash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))].slice(0,16).map(x=>x.toString(16).padStart(2,"0")).join("");
function walk(v, out=[]) {
  if (!v) return out;
  if (Array.isArray(v)) for (const x of v) walk(x,out);
  else if (typeof v === "object") {
    const t=v["@type"];
    if (t === "Event" || (Array.isArray(t) && t.includes("Event"))) out.push(v);
    if (v["@graph"]) walk(v["@graph"],out);
    if (v.itemListElement) walk(v.itemListElement,out);
    if (v.item) walk(v.item,out);
  }
  return out;
}
function jsonLd(html) {
  const found=[];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].replace(/<!--[\s\S]*?-->/g,"")),found); } catch {}
  }
  return found;
}
function links(html, base) {
  const out=[];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try { const u=new URL(m[1],base); if(u.origin===new URL(base).origin && /event|show|performance|concert|calendar|whats-on/i.test(u.pathname)) out.push(u.href); } catch {}
  }
  return [...new Set(out)].filter(x=>x!==base).slice(0,3);
}
async function get(url) {
  const r=await fetch(url,{headers:{"user-agent":"TwinCitiesArtsCalendar/1.0 (+calendar feed; respectful daily cache)",accept:"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(12000),cf:{cacheTtl:21600,cacheEverything:true}});
  return r.ok ? r.text() : "";
}
async function sourceEvents([org,url]) {
  try {
    const html=await get(url); let events=jsonLd(html);
    if (!events.length) {
      const pages=await Promise.all(links(html,url).map(get));
      events=pages.flatMap(jsonLd);
    }
    return events.map(e=>({ ...e, _org:org, _source:url }));
  } catch { return []; }
}
function place(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  const a=v.address||{};
  return [v.name,a.streetAddress,a.addressLocality,a.addressRegion,a.postalCode].filter(Boolean).join(", ");
}
function dt(v) {
  const d=new Date(v); if (!v || Number.isNaN(d.valueOf())) return null;
  return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
async function eventIcs(e) {
  const start=dt(e.startDate), end=dt(e.endDate);
  if (!start || !e.name) return "";
  const url=typeof e.url==="string" ? e.url : e._source;
  const uid=await hash(`${e._org}|${e.name}|${e.startDate}|${place(e.location)}`);
  const desc=[text(e.description),`Presented by ${e._org}.`,url].filter(Boolean).join("\\n\\n");
  const rows=["BEGIN:VEVENT",`UID:${uid}@twin-cities-performing-arts`,`DTSTAMP:${dt(new Date())}`,`DTSTART:${start}`];
  if(end) rows.push(`DTEND:${end}`);
  rows.push(`SUMMARY:${esc(`${text(e.name)} — ${e._org}`)}`,`LOCATION:${esc(place(e.location))}`,`DESCRIPTION:${esc(desc)}`,`URL:${esc(url)}`,`CATEGORIES:PERFORMING ARTS,${esc(e._org)}`,"STATUS:CONFIRMED","END:VEVENT");
  return rows.map(fold).join("\r\n");
}
export async function buildCalendar(sources=SOURCES) {
  const groups=await Promise.all(sources.map(sourceEvents));
  const cutoff=Date.now()-86400000;
  const raw=groups.flat().filter(e=>new Date(e.endDate||e.startDate).valueOf()>=cutoff);
  const seen=new Set(), unique=[];
  for(const e of raw) { const k=`${e._org}|${e.name}|${e.startDate}|${place(e.location)}`; if(!seen.has(k)){seen.add(k);unique.push(e);} }
  const bodies=(await Promise.all(unique.map(eventIcs))).filter(Boolean);
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Twin Cities Performing Arts//Master Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Twin Cities Performing Arts","X-WR-TIMEZONE:America/Chicago","REFRESH-INTERVAL;VALUE=DURATION:PT6H","X-PUBLISHED-TTL:PT6H",...bodies,"END:VCALENDAR",""] .join("\r\n");
}
export default { async fetch(request, env) {
  const u=new URL(request.url);
  if (u.pathname==="/calendar.ics") {
    const body=await buildCalendar();
    return new Response(body,{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":"inline; filename=twin-cities-performing-arts.ics","cache-control":"public, max-age=1800, s-maxage=21600","access-control-allow-origin":"*"}});
  }
  if (u.pathname==="/sources.json") return Response.json(SOURCES.map(([organization,url])=>({organization,url})),{headers:{"cache-control":"public,max-age=86400"}});
  const feed=new URL("/calendar.ics",u).href;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Twin Cities Performing Arts Calendar</title><style>body{font:18px system-ui;max-width:720px;margin:10vh auto;padding:24px;line-height:1.55;color:#17202a}a.button{display:inline-block;background:#512da8;color:white;padding:14px 20px;border-radius:10px;text-decoration:none}code{word-break:break-all;background:#f3f3f5;padding:3px 6px}</style><h1>Twin Cities Performing Arts</h1><p>A master calendar from ${SOURCES.length} major Minneapolis–Saint Paul performing-arts presenters and companies.</p><p><a class="button" href="webcal://${new URL(feed).host}/calendar.ics">Subscribe in Apple Calendar</a></p><p>Or add this subscription URL manually: <code>${feed}</code></p><p><a href="/sources.json">View included organizations</a></p>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public,max-age=3600"}});
}};
