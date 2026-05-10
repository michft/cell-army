import Calendar from '../Calendar';

/** @typedef {import("../types").DayId} DayId */
/** @typedef {import("../types").PlannerSession} PlannerSession */

/**
 * @param {{
 *   sessions: PlannerSession[],
 *   currentDay: DayId,
 *   onChangeDay: import("react").Dispatch<import("react").SetStateAction<DayId>>,
 *   onBrowseTime: (session: PlannerSession) => void,
 *   onToggleSave: (sessionId: string) => void
 * }} props
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
