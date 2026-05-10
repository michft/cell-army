import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import agenda from "./data/sessions.json";
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

/** @type {{ id: DayId, label: string, date: string }[]} */
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

/** @type {AgendaSession[]} */
const agendaSessions = /** @type {AgendaSession[]} */ (agenda.sessions);

/** @param {string} value */
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

/**
 * @param {{ tags: { namespace: string, label: string }[] }} session
 * @param {string} namespace
 */
function tagLabels(session, namespace) {
  return session.tags
    .filter((tag) => tag.namespace === namespace)
    .map((tag) => tag.label);
}

/** @param {string} label */
function speakerName(label) {
  return label.split(",")[0]?.trim() ?? label;
}

/** @param {{ tags: { namespace: string, label: string }[], plannerDay?: DayId }} session */
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

/** @param {{ code?: string, level: string }} session */
function sessionLevelCode(session) {
  const codeMatch = session.code?.match(/(\d)/);
  if (codeMatch) {
    return `${codeMatch[1]}00`;
  }
  return LEVEL_LABELS[/** @type {keyof typeof LEVEL_LABELS} */ (session.level)] ?? "Other";
}

/**
 * @param {string[]} current
 * @param {string} value
 */
function toggleSelection(current, value) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

/** @param {string | undefined} time */
function parseTimeValue(time) {
  if (typeof time !== "string") {
    return null;
  }

  const parts = time.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const [rawHours, rawMinutes] = parts;
  const hours = Number(rawHours.trim());
  const minutes = Number(rawMinutes.trim());

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
 * @param {number} startMinutes
 * @param {boolean} isLastWindow
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
 * @param {Array<{ startTime?: string, endTime?: string, tags: { namespace: string, label: string }[], plannerDay?: DayId }>} sessions
 * @param {DayId} dayId
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

/** @param {{ startTime?: string }} session */
function timeWindowValueForSession(session) {
  const startMinutes = parseTimeValue(session.startTime);
  if (startMinutes === null) {
    return "";
  }

  const windowStart = Math.floor(startMinutes / 60) * 60;
  return `${windowStart}-${windowStart + 60}`;
}

/**
 * @param {AgendaSession} session
 * @param {string} query
 * @param {string[]} topicFilters
 * @param {string[]} levelFilters
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

export default function App() {
  /** @type {import("react").MutableRefObject<StoredState | null>} */
  const initialStateRef = useRef(null);
  if (!initialStateRef.current && typeof window !== "undefined") {
    initialStateRef.current = loadState();
  }

  const initialState = initialStateRef.current ?? {
    profile: DEFAULT_PROFILE,
    /** @type {SavedSessions} */
    saved: {},
    /** @type {string[]} */
    likedSpeakers: [],
    /** @type {string[]} */
    likedOrgs: [],
  };

  const [screenIndex, setScreenIndex] = useState(0);
  const [currentDay, setCurrentDay] = useState(/** @type {DayId} */ ("day1"));
  const [browseDay, setBrowseDay] = useState(/** @type {DayId} */ ("day1"));
  const [viewMode, setViewMode] = useState("browse");
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
      const isSaved = Boolean(saved[session.id]?.saved);

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
  }, [browseDay, currentDay, sessions, timeWindow, viewMode]);

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
        dark: "#ffa500",
        light: "#13161c",
      },
    }).then(setQrCodeUrl);
  }, [profile]);

  /** @param {string} sessionId */
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

  /** @param {PlannerSession} session */
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
