import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import agenda from "./data/sessions.json";
import { DAY_OPTIONS, toggleSelection, tagLabels, speakerName, sessionLevelCode } from "./utils/session";
import SwipeCarousel from "./SwipeCarousel";
import IntroScreen from "./screens/IntroScreen";
import QRScreen from "./screens/QRScreen";
import BrowseScreen from "./screens/BrowseScreen";
import CalendarDayScreen from "./screens/CalendarDayScreen";

/** @typedef {import("./types").DayId} DayId */
/** @typedef {import("./types").AgendaSession} AgendaSession */
/** @typedef {import("./types").PlannerSession} PlannerSession */
/** @typedef {import("./types").Profile} Profile */
/** @typedef {import("./types").SavedSessions} SavedSessions */
/** @typedef {import("./types").StoredState} StoredState */

const APP_TITLE = import.meta.env.VITE_APP_TITLE || "AWS Summit Sydney Planner";
const AGENDA_URL = import.meta.env.VITE_AGENDA_URL || agenda.source.agendaUrl;

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

/** @type {AgendaSession[]} */
const agendaSessions = /** @type {AgendaSession[]} */ (agenda.sessions);

/**
 * Escape characters that must be backslash-escaped for ICS/VCARD text fields.
 * @param {string} value - The input text to escape.
 * @returns {string} The input with backslashes, newlines, commas and semicolons escaped for inclusion in an ICS/VCARD field.
 */
function escapeIcs(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Load persisted planner state from localStorage and merge the stored profile with defaults.
 *
 * If the stored value is missing or invalid, returns the default state.
 *
 * @returns {{ profile: Object, saved: Set<string>, likedSpeakers: string[], likedOrgs: string[] }}
 *   An object containing:
 *   - profile: the user profile merged with DEFAULT_PROFILE.
 *   - saved: a Set of saved session IDs (empty when none).
 *   - likedSpeakers: sorted array of liked speaker names (empty when none).
 *   - likedOrgs: sorted array of liked organisation names (empty when none).
 */
function loadState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return {
      profile: { ...DEFAULT_PROFILE, ...parsed?.profile },
      saved: new Set(parsed?.saved ?? []),
      likedSpeakers: parsed?.likedSpeakers ?? [],
      likedOrgs: parsed?.likedOrgs ?? [],
    };
  } catch {
    return {
      profile: DEFAULT_PROFILE,
      saved: new Set(),
      likedSpeakers: [],
      likedOrgs: [],
    };
  }
}



/**
 * Determine which planner day a session belongs to.
 *
 * Checks for a tag in the `GLOBAL#local-tags-aws-summit-anz-event-day` namespace and maps
 * `event-day-01` → `'day1'`, `event-day-02` → `'day2'`. If no marker tag is present,
 * falls back to `session.plannerDay` and then `'day1'`.
 *
 * @param {{ tags: { namespace: string, label: string }[], plannerDay?: string }} session - Session object; may include event-day tags and an optional `plannerDay` field.
 * @returns {string} `'day1'` or `'day2'` based on the tag, otherwise `session.plannerDay` or `'day1'`.
 */
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



function parseTimeValue(time) {
  if (typeof time !== "string") {
    return null;
  }

  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Produce a human-readable label for a one-hour time window starting at the given minutes.
 *
 * @param {number} startMinutes - Minutes from midnight at which the window starts (e.g. 540 for 09:00).
 * @param {boolean} isLastWindow - If true, render an open-ended end (e.g. `17:00+`) for the final window.
 * @returns {string} The formatted window label, e.g. `09:00-10:00` or `17:00+`.
 */
function formatWindowLabel(startMinutes, isLastWindow) {
  const startHours = String(Math.floor(startMinutes / 60)).padStart(2, "0");
  if (isLastWindow) {
    return `${startHours}:00+`;
  }

  const endHours = String(Math.floor((startMinutes + 60) / 60)).padStart(2, "0");
  return `${startHours}:00-${endHours}:00`;
}

/**
 * Build one-hour time window options for sessions assigned to a given planner day.
 *
 * Produces an array of one-hour windows that overlap at least one session on the specified day.
 * Each window covers a contiguous 60-minute interval aligned to hour boundaries, starting from the
 * earliest session time on that day and ending at the latest session time.
 *
 * @param {Array<{ startTime?: string, endTime?: string, tags: { namespace: string, label: string }[], plannerDay?: DayId }>} sessions - All sessions to consider.
 * @param {DayId} dayId - Planner day identifier to filter sessions (e.g. "day1" or "day2").
 * @returns {Array<{ value: string, label: string, startMinutes: number, endMinutes: number }>} An array of window objects. `value` is "start-end" in minutes, `label` is a human-readable hour range (the final window uses a trailing `+`), and `startMinutes`/`endMinutes` are the window bounds in minutes since midnight.
 */
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

/**
 * Compute the one-hour time window that contains a session's start time.
 *
 * If the session has no valid `startTime`, an empty string is returned.
 * @param {{ startTime?: string }} session - Session object with an optional `HH:MM` start time.
 * @returns {string} The window in minutes as `"startMinutes-endMinutes"` (for example `"540-600"`), or `""` if unavailable.
 */
function timeWindowValueForSession(session) {
  const startMinutes = parseTimeValue(session.startTime);
  if (startMinutes === null) {
    return "";
  }

  const windowStart = Math.floor(startMinutes / 60) * 60;
  return `${windowStart}-${windowStart + 60}`;
}

/**
 * Determine whether a session satisfies the given search query and active topic and level filters.
 *
 * The function performs a case-insensitive match against a combined searchable string composed of the
 * session's title, code, description, level, computed level code, speakers, organisations and technology category tags.
 * An empty `query`, empty `topicFilters` or empty `levelFilters` each act as no-op (match-all) for their respective criterion.
 *
 * @param {AgendaSession} session - Session object to test.
 * @param {string} query - Lowercased search string to match against the session's searchable fields; an empty string matches all sessions.
 * @param {string[]} topicFilters - Array of technology category labels; session must include at least one when this array is non-empty.
 * @param {string[]} levelFilters - Array of level codes (e.g. "100", "200"); session's computed level code must be present when this array is non-empty.
 * @returns {boolean} `true` if the session matches the query and all active filters, `false` otherwise.
 */
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

/**
 * Root React component that renders the conference planner UI.
 *
 * Initialises application state (loaded from localStorage when available), derives
 * visible sessions and day statistics, and renders the intro, QR, browse and calendar
 * screens with their controls and handlers.
 *
 * Side effects: updates document title, persists profile/likes/saved state to localStorage,
 * and generates a VCARD QR code when the profile changes.
 *
 * @returns {JSX.Element} The app root element containing the planner UI and footer.
 */
export default function App() {
  /** @type {import("react").MutableRefObject<StoredState | null>} */
  const initialStateRef = useRef(null);
  if (!initialStateRef.current && typeof window !== "undefined") {
    initialStateRef.current = loadState();
  }

  const initialState = initialStateRef.current ?? {
    profile: DEFAULT_PROFILE,
    /** `@type` {SavedSessions} */
    saved: new Set(),
    /** `@type` {string[]} */
    likedSpeakers: [],
    /** `@type` {string[]} */
    likedOrgs: [],
  };

  const [screenIndex, setScreenIndex] = useState(0);
  const [currentDay, setCurrentDay] = useState(/** @type {DayId} */ ("day1"));
  const [browseDay, setBrowseDay] = useState(/** @type {DayId} */ ("day1"));
  const [query, setQuery] = useState("");
  const [topicFilters, setTopicFilters] = useState(/** @type {string[]} */ ([]));
  const [levelFilters, setLevelFilters] = useState(/** @type {string[]} */ ([]));
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
          agendaSessions.flatMap((session) =>
            tagLabels(session, "GLOBAL#aws-technology-categories"),
          ),
        ),
      ).sort(),
    [],
  );

  const levels = useMemo(
    () =>
      Array.from(new Set(agendaSessions.map((session) => sessionLevelCode(session)))).sort(),
    [],
  );

  const timeWindowOptions = useMemo(
    () => buildTimeWindowOptions(agendaSessions, browseDay),
    [browseDay],
  );

  /** @type {PlannerSession[]} */
  const sessions = useMemo(() => {
    const filtered = agendaSessions.filter((session) =>
      sessionMatches(session, deferredQuery, topicFilters, levelFilters),
    );

    return filtered.map((session) => {
      const sessionSpeakers = session.speakers.map(speakerName);
      const speakerMatch = sessionSpeakers.some(/** @param {string} speaker */ (speaker) =>
        likedSpeakers.includes(speaker),
      );
      const orgMatch = session.organisations.some(/** @param {string} org */ (org) => likedOrgs.includes(org));
      const assignedDay = sessionPlannerDay(session);
      const isSaved = saved.has(session.id);

      return /** @type {PlannerSession} */ ({
        ...session,
        assignedDay,
        isSaved,
        isRecommended: speakerMatch || orgMatch,
        recommendationReason: speakerMatch
          ? "Liked speaker"
          : orgMatch
            ? "Liked organisation"
            : "",
      });
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

          if (
            sessionStart === null ||
            sessionEnd === null ||
            windowStart === undefined ||
            windowEnd === undefined
          ) {
            return false;
          }

          return sessionStart < windowEnd && sessionEnd > windowStart;
        });

    return timeFiltered;
  }, [browseDay, currentDay, sessions, timeWindow]);

  /** @type {import("./types").DayStat[]} */
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
      JSON.stringify({ profile, saved: Array.from(saved), likedSpeakers, likedOrgs }),
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
        dark: "#ffa500",
        light: "#13161c",
      },
    }).then(setQrCodeUrl);
  }, [profile]);

  /** @param {string} sessionId */
  function toggleSave(sessionId) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  /** @param {string} label */
  function toggleLikedSpeaker(label) {
    const name = speakerName(label);
    setLikedSpeakers((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name].sort(),
    );
  }

  /** @param {string} label */
  function toggleLikedOrg(label) {
    setLikedOrgs((current) =>
      current.includes(label)
        ? current.filter((value) => value !== label)
        : [...current, label].sort(),
    );
  }

  /** @param {number} direction */
  function cycleDay(direction) {
    const currentIndex = DAY_OPTIONS.findIndex((day) => day.id === currentDay);
    const nextIndex = (currentIndex + direction + DAY_OPTIONS.length) % DAY_OPTIONS.length;
    const nextDay = DAY_OPTIONS[nextIndex];
    if (nextDay) {
      setCurrentDay(nextDay.id);
    }
  }

  function resetPlanner() {
    const shouldReset = window.confirm(
      "Reset your filters, likes, and full saved schedule?",
    );

    if (!shouldReset) {
      return;
    }

    setQuery("");
    setTopicFilters([]);
    setLevelFilters([]);
    setTimeWindow("");
    setSaved(new Set());
    setLikedSpeakers([]);
    setLikedOrgs([]);
    setCurrentDay("day1");
    setBrowseDay("day1");
  }

  /** @param {PlannerSession} session */
  function browseSessionsForTime(session) {
    const browseWindow = timeWindowValueForSession(session);
    setBrowseDay(session.assignedDay);
    setCurrentDay(session.assignedDay);
    setTimeWindow(browseWindow);
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <SwipeCarousel screenIndex={screenIndex} onChangeScreen={setScreenIndex}>
          <IntroScreen 
            currentDay={currentDay}
            dayStats={dayStats}
            onChangeDay={setCurrentDay}
            touchStartX={touchStartX}
            eventName={agenda.event.name}
            eventVenue={agenda.event.venue}
            agendaUrl={AGENDA_URL}
          />

          <QRScreen 
            profile={profile}
            qrCodeUrl={qrCodeUrl}
            onProfileChange={setProfile}
          />

          <BrowseScreen
            topics={topics}
            levels={levels}
            query={query}
            onQueryChange={setQuery}
            topicFilters={topicFilters}
            onTopicFiltersChange={setTopicFilters}
            levelFilters={levelFilters}
            onLevelFiltersChange={setLevelFilters}
            browseDay={browseDay}
            onBrowseDayChange={setBrowseDay}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            timeWindowOptions={timeWindowOptions}
            visibleSessions={visibleSessions}
            likedOrgs={likedOrgs}
            likedSpeakers={likedSpeakers}
            onToggleSave={toggleSave}
            onToggleLikedOrg={toggleLikedOrg}
            onToggleLikedSpeaker={toggleLikedSpeaker}
            onResetPlanner={resetPlanner}
            likedOrgsCount={likedOrgs.length}
            likedSpeakersCount={likedSpeakers.length}
          />

          <CalendarDayScreen
            sessions={sessions}
            currentDay={currentDay}
            onChangeDay={setCurrentDay}
            onBrowseTime={browseSessionsForTime}
            onToggleSave={toggleSave}
          />
        </SwipeCarousel>

        <footer className="footer-note">
          Snapshot refreshed {new Date(agenda.source.fetchedAt).toLocaleString()} from AWS.
        </footer>
      </main>
    </div>
  );
}
