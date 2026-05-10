import { useEffect, useMemo, useState } from "react";

/** @typedef {import("./types").DayId} DayId */
/** @typedef {import("./types").PlannerSession} PlannerSession */

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

/**
 * Return the provided 24-hour time string in `HH:MM` form, or an empty string when no time is given.
 * @param {string|undefined} time24h - Time in `HH:MM` 24-hour format; may be `undefined`.
 * @returns {string} The formatted `HH:MM` string, or `""` if `time24h` is `undefined`.
 */
function formatTime(time24h) {
  if (!time24h) return "";
  const [hours, minutes] = time24h.split(":");
  return `${hours}:${minutes}`;
}

/**
 * Compute the session height in 30-minute grid units from start and end times.
 *
 * @param {string|undefined} startTime - Start time in "H:M" or "HH:MM" format; may be undefined to indicate missing time.
 * @param {string|undefined} endTime - End time in "H:M" or "HH:MM" format; may be undefined to indicate missing time.
 * @returns {number} The height expressed as an integer number of 30-minute slots; at least 1.
 */
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

/**
 * Compute the grid row for a session's start time on the calendar.
 *
 * @param {string | undefined} startTime - Start time as `"HH:MM"` (24-hour). If omitted, the function returns `0`.
 * @returns {number} The CSS grid row number where the session should start; each 30-minute interval advances the row by 1 and the result is offset by 2 to account for the header.
 */
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

/**
 * Render a two-day schedule view with selectable sessions and an available-sessions flyout.
 *
 * Renders time slots, saved sessions for the active day, a sidebar of available sessions that can be added,
 * and a modal summary for the selected session.
 *
 * @param {{
 *   sessions: PlannerSession[],
 *   currentDay: DayId,
 *   onChangeDay: import("react").Dispatch<import("react").SetStateAction<DayId>>,
 *   onBrowseTime: (session: PlannerSession) => void,
 *   onToggleSave: (sessionId: string) => void,
 * }} props - Component props.
 * @param {PlannerSession[]} props.sessions - All planner sessions; each may include scheduling and saved state.
 * @param {DayId} props.currentDay - Currently selected day identifier ("day1" or "day2").
 * @param {import("react").Dispatch<import("react").SetStateAction<DayId>>} props.onChangeDay - Callback to change the active day.
 * @param {(session: PlannerSession) => void} props.onBrowseTime - Callback invoked with a session when the user chooses to browse its time.
 * @param {(sessionId: string) => void} props.onToggleSave - Callback to toggle a session's saved state by id.
 * @returns {JSX.Element} The calendar UI for the current day, including time grid, sessions, flyout and session summary modal.
 */
export default function Calendar({ 
  sessions, 
  currentDay, 
  onChangeDay,
  onBrowseTime,
  onToggleSave,
}) {
  const [showFlyout, setShowFlyout] = useState(false);
  const [selectedSession, setSelectedSession] = useState(/** @type {PlannerSession | null} */ (null));
  
  const daysSessions = useMemo(() => {
    const day1Sessions = sessions.filter(s => s.assignedDay === "day1" && s.startTime && s.endTime);
    const day2Sessions = sessions.filter(s => s.assignedDay === "day2" && s.startTime && s.endTime);
    return { day1: day1Sessions, day2: day2Sessions };
  }, [sessions]);

  /** @type {PlannerSession[]} */
  const currentDayData = currentDay === "day1" ? daysSessions.day1 : daysSessions.day2;
  const selectedSessions = currentDayData.filter(s => s.isSaved);
  const availableSessions = currentDayData.filter(s => !s.isSaved);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    const stillVisible = selectedSessions.find((session) => session.id === selectedSession.id);
    if (!stillVisible) {
      setSelectedSession(null);
      return;
    }

    setSelectedSession(stillVisible);
  }, [selectedSession, selectedSessions]);

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>2-Day Schedule</h2>
      </div>

      <div className="calendar-days-tabs">
        <button
          className={currentDay === "day1" ? "day-tab is-active" : "day-tab"}
          onClick={() => onChangeDay("day1")}
          type="button"
        >
          Day 1 - 13 May
        </button>
        <button
          className={currentDay === "day2" ? "day-tab is-active" : "day-tab"}
          onClick={() => onChangeDay("day2")}
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
                      onClick={() => setSelectedSession(session)}
                      type="button"
                      title="View session details"
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

      {selectedSession ? (
        <div
          className="session-summary-backdrop"
          onClick={() => setSelectedSession(null)}
          role="presentation"
        >
          <section
            aria-labelledby="session-summary-title"
            className="session-summary-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="session-summary-header">
              <div>
                <p className="eyebrow">Scheduled session</p>
                <h3 id="session-summary-title">{selectedSession.title}</h3>
              </div>
              <button
                className="session-summary-close"
                onClick={() => setSelectedSession(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="session-summary-meta">
              <span className="code-badge">{selectedSession.code}</span>
              <span className="mini-chip">
                {formatTime(selectedSession.startTime)} - {formatTime(selectedSession.endTime)}
              </span>
              <span className="mini-chip">{selectedSession.sessionType}</span>
            </div>

            <p className="session-summary-copy">{selectedSession.description}</p>

            {selectedSession.speakers.length ? (
              <div className="session-summary-block">
                <span className="filter-label">Speakers</span>
                <div className="chip-row">
                  {selectedSession.speakers.map((speaker) => (
                    <span key={speaker} className="mini-chip">
                      {speaker}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedSession.organisations.length ? (
              <div className="session-summary-block">
                <span className="filter-label">Organisations</span>
                <div className="chip-row">
                  {selectedSession.organisations.map((org) => (
                    <span key={org} className="mini-chip">
                      {org}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="session-summary-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  onBrowseTime(selectedSession);
                  setSelectedSession(null);
                }}
                type="button"
              >
                Browse this time
              </button>
              <button
                className="primary-button is-active"
                onClick={() => {
                  onToggleSave(selectedSession.id);
                  setSelectedSession(null);
                }}
                type="button"
              >
                Remove from schedule
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
