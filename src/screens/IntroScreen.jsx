import { DAY_OPTIONS } from "../utils/session";

/** @typedef {import("../types").DayId} DayId */
/** @typedef {import("../types").DayStat} DayStat */

/**
 * Intro screen component for the event planner displaying event details and a day selector.
 *
 * `@param` {{
 *   currentDay: DayId,
 *   dayStats: DayStat[],
 *   onChangeDay: import("react").Dispatch<import("react").SetStateAction<DayId>>,
 *   touchStartX: import("react").MutableRefObject<number>,
 *   eventName: string,
 *   eventVenue: string,
 *   agendaUrl: string
 * }} props - Component props.
 * `@returns` {import("react").JSX.Element} The rendered intro screen element.
 */
export default function IntroScreen({ currentDay, dayStats, onChangeDay, touchStartX, eventName, eventVenue, agendaUrl }) {
  const FIXED_TIME_NOTE =
    "Sessions run at fixed summit times. This app helps you browse each day, mark the talks you plan to attend, and highlight future talks from speakers or organisations you liked.";

  /**
   * Change the selected day by cycling forwards or backwards, wrapping between the first and last day.
   *
   * @param {number} direction - Number of steps to move: positive to advance, negative to go back (wraps around). 
   */
  function cycleDay(direction) {
    const currentIndex = DAY_OPTIONS.findIndex((day) => day.id === currentDay);
    const nextIndex = (currentIndex + direction + DAY_OPTIONS.length) % DAY_OPTIONS.length;
    const nextDay = DAY_OPTIONS[nextIndex];
    if (nextDay) {
      onChangeDay(/** @type {DayId} */ (nextDay.id));
    }
  }

  return (
    <div className="carousel-screen">
      <section className="hero-card">
        <p className="eyebrow">Portrait planner</p>
        <div className="hero-heading-row">
          <div>
            <h1>{eventName}</h1>
            <p className="hero-meta">
              {DAY_OPTIONS.find((day) => day.id === currentDay)?.date} ·{" "}
              {eventVenue}
            </p>
          </div>
          <a className="outline-link" href={agendaUrl} target="_blank" rel="noreferrer">
            Online agenda
          </a>
        </div>
        <p className="hero-note">{FIXED_TIME_NOTE}</p>

        <div
          className="day-switcher"
          aria-label="Planner days"
          onTouchStart={(event) => {
            event.stopPropagation();
            touchStartX.current = event.changedTouches[0].clientX;
          }}
          onTouchEnd={(event) => {
            event.stopPropagation();
            const distance = event.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(distance) < 60) {
              return;
            }
            cycleDay(distance < 0 ? 1 : -1);
          }}
        >
          {dayStats.map((day) => (
            <button
              key={day.id}
              className={day.id === currentDay ? "day-pill is-active" : "day-pill"}
              onClick={() => onChangeDay(day.id)}
              type="button"
            >
              <span>{day.label}</span>
              <strong>{day.planned}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
