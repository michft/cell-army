import Calendar from '../Calendar';

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
