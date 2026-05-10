import Calendar from '../Calendar';

/** @typedef {import("../types").DayId} DayId */
/** @typedef {import("../types").PlannerSession} PlannerSession */

/**
 * Render the calendar screen for a specific day, passing sessions and interaction handlers to the Calendar component.
 *
 * @param {{
 *   sessions: PlannerSession[],
 *   currentDay: DayId,
 *   onChangeDay: import("react").Dispatch<import("react").SetStateAction<DayId>>,
 *   onBrowseTime: (session: PlannerSession) => void,
 *   onToggleSave: (sessionId: string) => void
 * }} props - Component props.
 * @param {PlannerSession[]} props.sessions - List of planner sessions to display.
 * @param {DayId} props.currentDay - Identifier of the currently selected day.
 * @param {import("react").Dispatch<import("react").SetStateAction<DayId>>} props.onChangeDay - Setter to change the current day.
 * @param {(session: PlannerSession) => void} props.onBrowseTime - Handler invoked to browse a session's time.
 * @param {(sessionId: string) => void} props.onToggleSave - Handler invoked to toggle the saved state of a session by id.
 * @returns {JSX.Element} The rendered calendar screen element.
 */
export default function CalendarDayScreen({
  sessions,
  currentDay,
  onChangeDay,
  onBrowseTime,
  onToggleSave,
}) {
  return (
    <div className="carousel-screen">
      <section className="calendar-section">
        <Calendar
          sessions={sessions}
          currentDay={currentDay}
          onChangeDay={onChangeDay}
          onBrowseTime={onBrowseTime}
          onToggleSave={onToggleSave}
        />
      </section>
    </div>
  );
}
