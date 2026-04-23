import { useMemo, useState } from "react";

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

function formatTime(time24h) {
  if (!time24h) return "";
  const [hours, minutes] = time24h.split(":");
  return `${hours}:${minutes}`;
}

function getSessionHeight(startTime, endTime) {
  if (!startTime || !endTime) return 1;
  
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  const duration = endMins - startMins;
  
  // Each 30-minute slot is one unit
  return Math.max(1, Math.ceil(duration / 30));
}

function getSessionTopOffset(startTime) {
  if (!startTime) return 0;
  
  const [hours, minutes] = startTime.split(":").map(Number);
  const firstSlotTime = TIME_SLOTS[0].split(":").map(Number);
  const firstSlotMins = firstSlotTime[0] * 60 + firstSlotTime[1];
  const sessionMins = hours * 60 + minutes;
  
  const offsetMins = Math.max(0, sessionMins - firstSlotMins);
  // Return grid row (each 30 minutes = 1 row, starting at row 2 for header)
  return Math.floor(offsetMins / 30) + 2;
}

export default function Calendar({ 
  sessions, 
  currentDay, 
  saved, 
  onToggleSave,
  dayLabel,
  dayDate,
}) {
  const [showFlyout, setShowFlyout] = useState(false);
  const [selectedDay, setSelectedDay] = useState("day1");
  
  const daysSessions = useMemo(() => {
    const day1Sessions = sessions.filter(s => s.assignedDay === "day1" && s.startTime && s.endTime);
    const day2Sessions = sessions.filter(s => s.assignedDay === "day2" && s.startTime && s.endTime);
    return { day1: day1Sessions, day2: day2Sessions };
  }, [sessions]);

  const currentDayData = selectedDay === "day1" ? daysSessions.day1 : daysSessions.day2;
  const selectedSessions = currentDayData.filter(s => s.isSaved);
  const availableSessions = currentDayData.filter(s => !s.isSaved);

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>2-Day Schedule</h2>
      </div>

      <div className="calendar-days-tabs">
        <button
          className={selectedDay === "day1" ? "day-tab is-active" : "day-tab"}
          onClick={() => setSelectedDay("day1")}
          type="button"
        >
          Day 1 - 13 May
        </button>
        <button
          className={selectedDay === "day2" ? "day-tab is-active" : "day-tab"}
          onClick={() => setSelectedDay("day2")}
          type="button"
        >
          Day 2 - 14 May
        </button>
      </div>

      <div className="calendar-layout">
        {/* Main Calendar View */}
        <div className="calendar-main">
          <div className="calendar-timegrid">
            <div className="time-labels">
              <div className="time-label-header">Time</div>
              {TIME_SLOTS.map((time) => (
                <div key={`label-${time}`} className="time-label">
                  {time}
                </div>
              ))}
            </div>

            <div className="sessions-track">
              <div className="time-grid-lines">
                {TIME_SLOTS.map((time) => (
                  <div key={`grid-${time}`} className="time-slot" />
                ))}
              </div>

              <div className="sessions-overlay">
                {selectedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="calendar-session is-selected"
                    style={{
                      gridColumn: 1,
                      gridRow: `${getSessionTopOffset(session.startTime)} / span ${getSessionHeight(session.startTime, session.endTime)}`,
                    }}
                  >
                    <button
                      className="calendar-session-btn"
                      onClick={() => onToggleSave(session.id)}
                      type="button"
                      title={`Click to remove from schedule`}
                    >
                      <span className="session-time">
                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                      </span>
                      <span className="session-code">{session.code}</span>
                      <span className="session-title">{session.title}</span>
                      <span className="session-type">{session.sessionType}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedSessions.length === 0 && (
            <div className="calendar-empty">
              <p>No sessions scheduled yet.</p>
              <p>Click "Add" on available sessions in the sidebar to build your schedule.</p>
            </div>
          )}
        </div>

        {/* Flyout Sidebar */}
        <div className={`calendar-flyout ${showFlyout ? "is-open" : ""}`}>
          <button
            className="flyout-toggle"
            onClick={() => setShowFlyout(!showFlyout)}
            type="button"
            title={showFlyout ? "Hide available sessions" : "Show available sessions"}
          >
            {showFlyout ? "✕" : "→"}
          </button>

          <div className="flyout-content">
            <h3>Available Sessions</h3>
            <p className="flyout-count">{availableSessions.length} sessions</p>

            <div className="available-sessions-list">
              {availableSessions.map((session) => (
                <div key={session.id} className="available-session">
                  <div className="session-header">
                    <span className="session-code">{session.code}</span>
                    <span className="session-time">
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </span>
                  </div>
                  <h4>{session.title}</h4>
                  <p className="session-type">{session.sessionType}</p>
                  <button
                    className="add-session-btn"
                    onClick={() => onToggleSave(session.id)}
                    type="button"
                  >
                    + Add
                  </button>
                </div>
              ))}
              {availableSessions.length === 0 && (
                <div className="no-sessions">
                  <p>All sessions added to your schedule! 🎉</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="calendar-legend">
        <div className="legend-item is-saved">
          <div className="legend-color"></div>
          <span>Sessions in your schedule</span>
        </div>
      </div>
    </div>
  );
}
