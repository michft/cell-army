import { useEffect, useMemo, useState } from "react";

/** @typedef {import("./types").DayId} DayId */
/** @typedef {import("./types").PlannerSession} PlannerSession */

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

/** @param {string | undefined} time24h */
function formatTime(time24h) {
  if (!time24h) return "";
  const [hours, minutes] = time24h.split(":");
  return `${hours}:${minutes}`;
}

/**
 * @param {string | undefined} startTime
 * @param {string | undefined} endTime
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

/** @param {string | undefined} startTime */
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
 * @param {{
 *   sessions: PlannerSession[],
 *   currentDay: DayId,
 *   onChangeDay: import("react").Dispatch<import("react").SetStateAction<DayId>>,
 *   onBrowseTime: (session: PlannerSession) => void,
 *   onToggleSave: (sessionId: string) => void,
 * }} props
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
