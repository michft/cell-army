import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import agenda from "./data/sessions.json";
import Calendar from "./Calendar";

const APP_TITLE = import.meta.env.VITE_APP_TITLE || "AWS Summit Sydney Planner";
const AGENDA_URL = import.meta.env.VITE_AGENDA_URL || agenda.source.agendaUrl;

const DAY_OPTIONS = [
  { id: "day1", label: "Day 1", date: "13 May" },
  { id: "day2", label: "Day 2", date: "14 May" },
];

const STORAGE_KEY = "aws-summit-sydney-planner";
const DEFAULT_PROFILE = {
  name: "",
  role: "",
  company: "",
  email: "",
  phone: "",
};

const PROFILE_FIELDS = [
  { key: "name", label: "Name", type: "text", placeholder: "Your name" },
  { key: "role", label: "Role", type: "text", placeholder: "Your role" },
  { key: "company", label: "Company", type: "text", placeholder: "Your company" },
  { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+61 4xx xxx xxx" },
];

const FIXED_TIME_NOTE =
  "Sessions run at fixed summit times. This app helps you browse each day, mark the talks you plan to attend, and highlight future talks from speakers or organisations you liked.";

const LEVEL_LABELS = {
  foundational: "100",
  intermediate: "200",
  advanced: "300",
  expert: "400",
  unspecified: "Other",
};

function escapeIcs(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function loadState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return {
      profile: { ...DEFAULT_PROFILE, ...parsed?.profile },
      saved: parsed?.saved ?? {},
      likedSpeakers: parsed?.likedSpeakers ?? [],
      likedOrgs: parsed?.likedOrgs ?? [],
    };
  } catch {
    return {
      profile: DEFAULT_PROFILE,
      saved: {},
      likedSpeakers: [],
      likedOrgs: [],
    };
  }
}

function tagLabels(session, namespace) {
  return session.tags
    .filter((tag) => tag.namespace === namespace)
    .map((tag) => tag.label);
}

function speakerName(label) {
  return label.split(",")[0]?.trim() ?? label;
}

function sessionPlannerDay(session) {
  const taggedDay = session.tags.find(
    (tag) => tag.namespace === "GLOBAL#local-tags-aws-summit-anz-event-day",
  )?.label;

  if (taggedDay === "event-day-01") {
    return "day1";
  }

  if (taggedDay === "event-day-02") {
    return "day2";
  }

  return session.plannerDay ?? "day1";
}

function sessionLevelCode(session) {
  const codeMatch = session.code?.match(/(\d)/);
  if (codeMatch) {
    return `${codeMatch[1]}00`;
  }
  return LEVEL_LABELS[session.level] ?? "Other";
}

function toggleSelection(current, value) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

function parseTimeValue(time) {
  if (!time) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatWindowLabel(startMinutes, isLastWindow) {
  const startHours = String(Math.floor(startMinutes / 60)).padStart(2, "0");
  if (isLastWindow) {
    return `${startHours}:00+`;
  }

  const endHours = String(Math.floor((startMinutes + 60) / 60)).padStart(2, "0");
  return `${startHours}:00-${endHours}:00`;
}

function buildTimeWindowOptions(sessions, dayId) {
  const starts = sessions
    .filter((session) => sessionPlannerDay(session) === dayId)
    .flatMap((session) => [parseTimeValue(session.startTime), parseTimeValue(session.endTime)])
    .filter((value) => value !== null);

  if (starts.length === 0) {
    return [];
  }

  const firstHour = Math.floor(Math.min(...starts) / 60) * 60;
  const lastHour = Math.floor((Math.max(...starts) - 1) / 60) * 60;
  const windows = [];

  for (let startMinutes = firstHour; startMinutes <= lastHour; startMinutes += 60) {
    const endMinutes = startMinutes + 60;
    const hasOverlap = sessions.some((session) => {
      if (sessionPlannerDay(session) !== dayId) {
        return false;
      }

      const sessionStart = parseTimeValue(session.startTime);
      const sessionEnd = parseTimeValue(session.endTime);
      if (sessionStart === null || sessionEnd === null) {
        return false;
      }

      return sessionStart < endMinutes && sessionEnd > startMinutes;
    });

    if (hasOverlap) {
      windows.push({
        value: `${startMinutes}-${endMinutes}`,
        label: formatWindowLabel(startMinutes, startMinutes === lastHour),
        startMinutes,
        endMinutes,
      });
    }
  }

  return windows;
}

function timeWindowValueForSession(session) {
  const startMinutes = parseTimeValue(session.startTime);
  if (startMinutes === null) {
    return "";
  }

  const windowStart = Math.floor(startMinutes / 60) * 60;
  return `${windowStart}-${windowStart + 60}`;
}

function sessionMatches(session, query, topicFilters, levelFilters) {
  const topics = tagLabels(session, "GLOBAL#aws-technology-categories");
  const levelCode = sessionLevelCode(session);
  const haystack = [
    session.title,
    session.code,
    session.description,
    session.level,
    levelCode,
    ...session.speakers,
    ...session.organisations,
    ...topics,
  ]
    .join(" ")
    .toLowerCase();

  const queryHit = !query || haystack.includes(query);
  const topicHit = topicFilters.length === 0 || topicFilters.some((topic) => topics.includes(topic));
  const levelHit = levelFilters.length === 0 || levelFilters.includes(levelCode);

  return queryHit && topicHit && levelHit;
}

export default function App() {
  const initialStateRef = useRef(null);
  if (!initialStateRef.current && typeof window !== "undefined") {
    initialStateRef.current = loadState();
  }

  const initialState = initialStateRef.current ?? {
    profile: DEFAULT_PROFILE,
    saved: {},
    likedSpeakers: [],
    likedOrgs: [],
  };

  const [currentDay, setCurrentDay] = useState("day1");
  const [browseDay, setBrowseDay] = useState("day1");
  const [viewMode, setViewMode] = useState("browse");
  const [query, setQuery] = useState("");
  const [topicFilters, setTopicFilters] = useState([]);
  const [levelFilters, setLevelFilters] = useState([]);
  const [timeWindow, setTimeWindow] = useState("");
  const [profile, setProfile] = useState(initialState.profile);
  const [saved, setSaved] = useState(initialState.saved);
  const [likedSpeakers, setLikedSpeakers] = useState(initialState.likedSpeakers);
  const [likedOrgs, setLikedOrgs] = useState(initialState.likedOrgs);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const touchStartX = useRef(0);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const topics = useMemo(
    () =>
      Array.from(
        new Set(
          agenda.sessions.flatMap((session) =>
            tagLabels(session, "GLOBAL#aws-technology-categories"),
          ),
        ),
      ).sort(),
    [],
  );

  const levels = useMemo(
    () =>
      Array.from(new Set(agenda.sessions.map((session) => sessionLevelCode(session)))).sort(),
    [],
  );

  const timeWindowOptions = useMemo(
    () => buildTimeWindowOptions(agenda.sessions, browseDay),
    [browseDay],
  );

  const sessions = useMemo(() => {
    const filtered = agenda.sessions.filter((session) =>
      sessionMatches(session, deferredQuery, topicFilters, levelFilters),
    );

    return filtered.map((session) => {
      const sessionSpeakers = session.speakers.map(speakerName);
      const speakerMatch = sessionSpeakers.some((speaker) =>
        likedSpeakers.includes(speaker),
      );
      const orgMatch = session.organisations.some((org) => likedOrgs.includes(org));
      const assignedDay = sessionPlannerDay(session);
      const isSaved = Boolean(saved[session.id]?.saved);

      return {
        ...session,
        assignedDay,
        isSaved,
        isRecommended: speakerMatch || orgMatch,
        recommendationReason: speakerMatch
          ? "Liked speaker"
          : orgMatch
            ? "Liked organisation"
            : "",
      };
    });
  }, [deferredQuery, levelFilters, likedOrgs, likedSpeakers, saved, topicFilters]);

  const visibleSessions = useMemo(() => {
    const alphabetized = [...sessions].sort((left, right) =>
      left.title.localeCompare(right.title),
    );

    const timeFiltered = !timeWindow
      ? alphabetized.filter((session) => session.assignedDay === browseDay)
      : alphabetized.filter((session) => {
          if (session.assignedDay !== browseDay) {
            return false;
          }

          const [windowStart, windowEnd] = timeWindow.split("-").map(Number);
          const sessionStart = parseTimeValue(session.startTime);
          const sessionEnd = parseTimeValue(session.endTime);

          if (sessionStart === null || sessionEnd === null) {
            return false;
          }

          return sessionStart < windowEnd && sessionEnd > windowStart;
        });

    if (viewMode === "planned") {
      return alphabetized.filter((session) => session.isSaved);
    }

    if (viewMode === "recommended") {
      return alphabetized
        .filter((session) => session.isRecommended)
        .sort((left, right) => {
          const leftScore =
            Number(left.assignedDay === currentDay) * 4 +
            Number(left.isSaved) * 3 +
            Number(left.isRecommended) * 2;
          const rightScore =
            Number(right.assignedDay === currentDay) * 4 +
            Number(right.isSaved) * 3 +
            Number(right.isRecommended) * 2;

          if (leftScore !== rightScore) {
            return rightScore - leftScore;
          }

          return left.title.localeCompare(right.title);
        });
    }

    return timeFiltered;
  }, [currentDay, sessions, timeWindow, viewMode]);

  const dayStats = useMemo(
    () =>
      DAY_OPTIONS.map((day) => ({
        ...day,
        planned: sessions.filter(
          (session) => session.assignedDay === day.id && session.isSaved,
        ).length,
      })),
    [sessions],
  );

  useEffect(() => {
    if (timeWindow && !timeWindowOptions.some((option) => option.value === timeWindow)) {
      setTimeWindow("");
    }
  }, [timeWindow, timeWindowOptions]);

  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile, saved, likedSpeakers, likedOrgs }),
    );
  }, [likedOrgs, likedSpeakers, profile, saved]);

  useEffect(() => {
    const name = profile.name.trim();
    const role = profile.role.trim();
    const company = profile.company.trim();
    const email = profile.email.trim();
    const phone = profile.phone.trim();

    const payload = [
      "BEGIN:VCARD",
      "VERSION:2.0",
      ...(name ? [`FN:${escapeIcs(name)}`] : []),
      ...(role ? [`TITLE:${escapeIcs(role)}`] : []),
      ...(company ? [`ORG:${escapeIcs(company)}`] : []),
      ...(email ? [`EMAIL:${escapeIcs(email)}`] : []),
      ...(phone ? [`TEL:${escapeIcs(phone)}`] : []),
      "END:VCARD",
    ].join("\r\n");

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 256,
      color: {
        dark: "#f63b4f",
        light: "#13161c",
      },
    }).then(setQrCodeUrl);
  }, [profile]);

  function toggleSave(sessionId) {
    setSaved((current) => {
      const next = { ...current };
      if (next[sessionId]?.saved) {
        delete next[sessionId];
        return next;
      }
      next[sessionId] = { saved: true };
      return next;
    });
  }

  function toggleLikedSpeaker(label) {
    const name = speakerName(label);
    setLikedSpeakers((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name].sort(),
    );
  }

  function toggleLikedOrg(label) {
    setLikedOrgs((current) =>
      current.includes(label)
        ? current.filter((value) => value !== label)
        : [...current, label].sort(),
    );
  }

  function cycleDay(direction) {
    const currentIndex = DAY_OPTIONS.findIndex((day) => day.id === currentDay);
    const nextIndex = (currentIndex + direction + DAY_OPTIONS.length) % DAY_OPTIONS.length;
    setCurrentDay(DAY_OPTIONS[nextIndex].id);
  }

  function resetPlanner() {
    const shouldReset = window.confirm(
      "Reset your filters, likes, and full saved schedule?",
    );

    if (!shouldReset) {
      return;
    }

    setViewMode("browse");
    setQuery("");
    setTopicFilters([]);
    setLevelFilters([]);
    setTimeWindow("");
    setSaved({});
    setLikedSpeakers([]);
    setLikedOrgs([]);
    setCurrentDay("day1");
    setBrowseDay("day1");
  }

  function browseSessionsForTime(session) {
    const browseWindow = timeWindowValueForSession(session);
    setBrowseDay(session.assignedDay);
    setCurrentDay(session.assignedDay);
    setTimeWindow(browseWindow);
    setViewMode("browse");
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <section className="hero-card">
          <p className="eyebrow">Portrait planner</p>
          <div className="hero-heading-row">
            <div>
              <h1>{agenda.event.name}</h1>
              <p className="hero-meta">
                {DAY_OPTIONS.find((day) => day.id === currentDay)?.date} ·{" "}
                {agenda.event.venue}
              </p>
            </div>
            <a className="outline-link" href={AGENDA_URL} target="_blank" rel="noreferrer">
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
                onClick={() => setCurrentDay(day.id)}
                type="button"
              >
                <span>{day.label}</span>
                <strong>{day.planned}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="identity-card">
          <div>
            <p className="eyebrow">Who am I</p>
          </div>
          <div className="identity-grid">
            <div className="qr-panel">
              {qrCodeUrl ? <img alt="QR code for attendee identity" src={qrCodeUrl} /> : null}
              <p>Show this when someone asks who you are :)</p>
            </div>
            <div className="profile-form">
              {PROFILE_FIELDS.map(({ key, label, type, placeholder }) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={profile[key]}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="toolbar-card">
          <div className="segmented-control">
            {[
              { id: "browse", label: "Browse" },
              { id: "calendar", label: "Calendar" },
              { id: "planned", label: "My list" },
              { id: "recommended", label: "Future talks" },
            ].map((option) => (
              <button
                key={option.id}
                className={viewMode === option.id ? "segment is-active" : "segment"}
                onClick={() => setViewMode(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            <button className="segment reset-segment" onClick={resetPlanner} type="button">
              Reset
            </button>
          </div>

          <div className="search-row">
            <input
              aria-label="Search talks"
              className="search-input"
              placeholder="Search title, speaker, org, topic"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {viewMode !== "calendar" && (
            <>
          <div className="filter-stack">
            <div className="filter-group">
              <span className="filter-label">Topics</span>
              <div className="chip-row">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    className={
                      topicFilters.includes(topic) ? "topic-chip is-active" : "topic-chip"
                    }
                    onClick={() =>
                      setTopicFilters((current) => toggleSelection(current, topic))
                    }
                    type="button"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Talk level</span>
              <div className="chip-row">
                {levels.map((level) => (
                  <button
                    key={level}
                    className={
                      levelFilters.includes(level) ? "topic-chip is-active" : "topic-chip"
                    }
                    onClick={() =>
                      setLevelFilters((current) => toggleSelection(current, level))
                    }
                    type="button"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === "browse" ? (
              <div className="filter-group">
                <div className="gap-filter-header">
                  <span className="filter-label">Fill a gap on</span>
                  <div className="chip-row">
                    {DAY_OPTIONS.map((day) => (
                      <button
                        key={day.id}
                        className={browseDay === day.id ? "topic-chip is-active" : "topic-chip"}
                        onClick={() => setBrowseDay(day.id)}
                        type="button"
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <select
                  id="time-window-select"
                  className="topic-select"
                  value={timeWindow}
                  onChange={(event) => setTimeWindow(event.target.value)}
                >
                  <option value="">Any time</option>
                  {timeWindowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="liked-strip">
            <span>Liked</span>
            {topicFilters.map((label) => (
              <span key={`topic-${label}`} className="mini-chip">
                {label}
              </span>
            ))}
            {levelFilters.map((label) => (
              <span key={`level-${label}`} className="mini-chip">
                {label}
              </span>
            ))}
            {[...likedSpeakers, ...likedOrgs].slice(0, 8).map((label) => (
              <span key={label} className="mini-chip">
                {label}
              </span>
            ))}
            {likedSpeakers.length === 0 && likedOrgs.length === 0 ? (
              <span className="muted-copy">Tap a speaker or org on a card to surface related talks.</span>
            ) : null}
          </div>
            </>
          )}
        </section>

        {viewMode === "calendar" ? (
          <section className="calendar-section">
            <Calendar
              sessions={sessions}
              currentDay={currentDay}
              onChangeDay={setCurrentDay}
              onBrowseTime={browseSessionsForTime}
              onToggleSave={toggleSave}
            />
          </section>
        ) : (
        <section className="cards-grid">
          {visibleSessions.map((session) => {
            const topicsForSession = tagLabels(session, "GLOBAL#aws-technology-categories");
            return (
              <article
                key={session.id}
                className={session.isRecommended ? "session-card is-recommended" : "session-card"}
              >
                <div className="card-topline">
                  <span className="code-badge">{session.code}</span>
                  <button
                    className={
                      levelFilters.includes(sessionLevelCode(session))
                        ? "level-badge is-active"
                        : "level-badge"
                    }
                    onClick={() =>
                      setLevelFilters((current) =>
                        toggleSelection(current, sessionLevelCode(session)),
                      )
                    }
                    type="button"
                  >
                    {sessionLevelCode(session)}
                  </button>
                  {session.recommendationReason ? (
                    <span className="signal-badge">{session.recommendationReason}</span>
                  ) : null}
                </div>

                <h3>{session.title}</h3>
                <p className="session-type">{session.sessionType}</p>
                <p className="session-description">{session.description}</p>

                <div className="chip-row">
                  {topicsForSession.slice(0, 3).map((topic) => (
                    <button
                      key={topic}
                      className={
                        topicFilters.includes(topic) ? "topic-chip is-active" : "topic-chip"
                      }
                      onClick={() =>
                        setTopicFilters((current) => toggleSelection(current, topic))
                      }
                      type="button"
                    >
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="chip-row">
                  {session.organisations.map((org, index) => (
                    <button
                      key={`${session.id}-org-${org}-${index}`}
                      className={likedOrgs.includes(org) ? "toggle-chip is-active" : "toggle-chip"}
                      onClick={() => toggleLikedOrg(org)}
                      type="button"
                    >
                      {org}
                    </button>
                  ))}
                </div>

                {session.speakers.length ? (
                  <div className="speaker-list">
                    {session.speakers.map((speaker, index) => {
                      const name = speakerName(speaker);
                      return (
                        <button
                          key={`${session.id}-speaker-${speaker}-${index}`}
                          className={
                            likedSpeakers.includes(name)
                              ? "speaker-chip is-active"
                              : "speaker-chip"
                          }
                          onClick={() => toggleLikedSpeaker(speaker)}
                          type="button"
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="card-actions">
                  <button
                    className={
                      session.isSaved
                        ? "primary-button is-active"
                        : "primary-button"
                    }
                    onClick={() => toggleSave(session.id)}
                    type="button"
                  >
                    {session.isSaved ? "Attending" : "Add"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
        )}

        {visibleSessions.length === 0 && viewMode !== "calendar" ? (
          <section className="empty-card">
            <h2>No talks match this view</h2>
            <p>Try another topic, clear the search, or like a speaker first.</p>
          </section>
        ) : null}

        <footer className="footer-note">
          Snapshot refreshed {new Date(agenda.source.fetchedAt).toLocaleString()} from AWS.
        </footer>
      </main>
    </div>
  );
}
