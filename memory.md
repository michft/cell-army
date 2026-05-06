# Memory

## Project Facts
- Project name: conferenceapp
- Goal: Build a portrait-first AWS Summit Sydney session planner.
- Primary users: Attendees who want to pick talks on mobile during the summit.

## Decisions
- Use a React + Vite frontend.
- Import a local snapshot of the AWS public agenda API to avoid browser CORS issues.
- Treat sessions as fixed-time talks the user marks for attendance, not user-scheduled items.

## Conventions
- Mobile-first layout with portrait emphasis.

## Agenda Data
- https://aws.amazon.com/events/summits/sydney/agenda/
