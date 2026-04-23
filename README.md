# conferenceapp

## Overview
Mobile-first AWS Summit Sydney talk planner for portrait screens.

The app ships with a local snapshot of the official AWS Sydney Summit 2026 agenda catalogue from:
`https://aws.amazon.com/events/summits/sydney/agenda/`

It includes:
- left-right swipe between Day 1 and Day 2 planner views
- a QR badge for attendee identity
- session search and topic filtering
- mark-attending tracking for fixed-time summit sessions
- liked speaker and liked organisation highlighting for future talks

## Stack
- React
- Vite
- local JSON agenda snapshot generated from the public AWS catalogue API
- Vercel static hosting

## Environment
Copy the example env file and adjust values if needed:

```sh
cp .env.example .env.local
```

Available variables:
- `VITE_APP_TITLE`: browser tab title
- `VITE_AGENDA_URL`: external AWS agenda link used by the app

## Run Locally
```sh
pnpm install
pnpm dev
```

## Refresh The AWS Agenda Snapshot
```sh
pnpm refresh:agenda
```

This refreshes `src/data/sessions.json`.

## Deploy On Vercel
The repo includes [`vercel.json`](/Users/mt/src/conferenceapp/vercel.json) configured for a Vite static build.

1. Install dependencies:
```sh
pnpm install
```

2. Log in to Vercel if needed:
```sh
pnpm dlx vercel login
```

3. Deploy a preview build:
```sh
pnpm dlx vercel
```

4. Deploy to production:
```sh
pnpm dlx vercel --prod
```

5. In the Vercel project settings, add the same environment variables from `.env.local`:
- `VITE_APP_TITLE`
- `VITE_AGENDA_URL`

If you prefer, you can also pull Vercel-managed env vars locally:

```sh
pnpm dlx vercel env pull .env.local
```

## Notes
- The public AWS catalogue feed exposes session metadata, speakers, organisations, and tags.
- Sessions are treated as fixed-time summit talks that the user attends at their published running times, not user-scheduled appointments.
- The public AWS catalogue feed still does not expose explicit per-session day/time slots, so the current two-day split is only a browsing aid until AWS exposes official schedule fields.
