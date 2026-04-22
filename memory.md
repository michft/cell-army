# Memory

## Project Facts
- Project name: conferenceapp
- Goal: Build a portrait-first AWS Summit Sydney session planner.
- Primary users: Attendees who want to pick talks on mobile during the summit.

## Decisions
- Use a React + Vite frontend.
- Import a local snapshot of the AWS public agenda API to avoid browser CORS issues.
- Treat sessions as fixed-time talks the user marks for attendance, not user-scheduled items.
- Keep Day 1 and Day 2 as browsing lanes because the public AWS feed does not expose explicit session schedule slots.

## Conventions
- Mobile-first layout with portrait emphasis.
