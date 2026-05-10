const DAY_OPTIONS = [
  { id: "day1", label: "Day 1", date: "13 May" },
  { id: "day2", label: "Day 2", date: "14 May" },
];

export default function IntroScreen({ currentDay, dayStats, onChangeDay, touchStartX, eventName, eventVenue, agendaUrl }) {
  const FIXED_TIME_NOTE =
    "Sessions run at fixed summit times. This app helps you browse each day, mark the talks you plan to attend, and highlight future talks from speakers or organisations you liked.";

  function cycleDay(direction) {
    const currentIndex = DAY_OPTIONS.findIndex((day) => day.id === currentDay);
    const nextIndex = (currentIndex + direction + DAY_OPTIONS.length) % DAY_OPTIONS.length;
    onChangeDay(DAY_OPTIONS[nextIndex].id);
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
            touchStartX.current = event.changedTouches[0].clientX;
          }}
          onTouchEnd={(event) => {
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
