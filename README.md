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

## Run
```sh
pnpm install
pnpm dev
```

## Refresh The AWS Agenda Snapshot
```sh
pnpm refresh:agenda
```

This refreshes `src/data/sessions.json`.

## Notes
- The public AWS catalogue feed exposes session metadata, speakers, organisations, and tags.
- Sessions are treated as fixed-time summit talks that the user attends at their published running times, not user-scheduled appointments.
- The public AWS catalogue feed still does not expose explicit per-session day/time slots, so the current two-day split is only a browsing aid until AWS exposes official schedule fields.
