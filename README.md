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
- Expo
- React Native
- Metro
- local JSON agenda snapshot generated from the public AWS catalogue API

## Environment
Copy the example env file and adjust values if needed:

```sh
cp .env.example .env.local
```

Available variables:
- `EXPO_PUBLIC_APP_TITLE`: app header title
- `EXPO_PUBLIC_AGENDA_URL`: external AWS agenda link used by the app

## Run Locally
```sh
pnpm install
pnpm start
```

Then open the app in Expo Go, an iOS simulator, an Android emulator, or press the
platform shortcut shown by Expo CLI.

## Refresh The AWS Agenda Snapshot
```sh
pnpm refresh:agenda
```

This refreshes `src/data/sessions.json`.

## Native App Notes
The project now uses Expo and Metro rather than Vite. The app entry is
[`index.js`](index.js), the native app config is [`app.json`](app.json), and the
React Native UI is in [`src/App.tsx`](src/App.tsx).

## Deploy Web On Vercel
The repo includes [`vercel.json`](vercel.json) for Expo web static output.

Vercel should use:
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:web`
- Output directory: `dist`

Set these environment variables in the Vercel project:
- `EXPO_PUBLIC_APP_TITLE`
- `EXPO_PUBLIC_AGENDA_URL`

## Notes
- The public AWS catalogue feed exposes session metadata, speakers, organisations, and tags.
- Sessions are treated as fixed-time summit talks that the user attends at their published running times, not user-scheduled appointments.
- The public AWS catalogue feed still does not expose explicit per-session day/time slots, so the current two-day split is only a browsing aid until AWS exposes official schedule fields.
