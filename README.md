# Twin Cities Performing Arts Calendar

A webcal-compatible Apple Calendar subscription that aggregates structured event data published by major performing-arts organizations across Minneapolis–Saint Paul.

## Deploy with GitHub Pages (recommended)

1. Create a GitHub repository and push this directory to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open **Actions → Refresh and publish calendar → Run workflow** for the first publication.
5. Open the Pages URL and select **Subscribe in Apple Calendar**.

The workflow refreshes the feed every six hours and refuses to replace the last good publication when no events can be discovered.

## Deploy with Cloudflare Workers

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Authenticate once with `npx wrangler login`.
4. Run `npm run deploy`.
5. Open the deployed URL and click **Subscribe in Apple Calendar**.

The permanent subscription endpoint is `https://YOUR-WORKER.workers.dev/calendar.ics`. Apple Calendar periodically refreshes subscribed calendars; the service additionally advertises a six-hour refresh interval.

## Coverage and behavior

The source registry contains 28 major theater, music, opera, dance, and multidisciplinary organizations. It reads schema.org `Event` data from official pages, follows a small number of same-site event links when needed, deduplicates performances, excludes ended events, and keeps official ticket/source URLs in each entry. Results are cached to limit traffic to arts organizations.

Because organizations can redesign their sites or omit structured event markup, `/sources.json` is the auditable coverage list and should be checked periodically. A source with no compatible event data safely contributes zero entries rather than inventing dates.

## Validate locally

Run `npm run check`.
