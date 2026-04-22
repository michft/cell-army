import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import agenda from "./data/sessions.json";

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

function sessionMatches(session, query, topicFilter) {
  const topics = tagLabels(session, "GLOBAL#aws-technology-categories");
  const haystack = [
    session.title,
    session.code,
    session.description,
    ...session.speakers,
    ...session.organisations,
    ...topics,
  ]
    .join(" ")
    .toLowerCase();

  const queryHit = !query || haystack.includes(query);
  const topicHit = topicFilter === "all" || topics.includes(topicFilter);

  return queryHit && topicHit;
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
  const [viewMode, setViewMode] = useState("browse");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
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

  const sessions = useMemo(() => {
    const filtered = agenda.sessions.filter((session) =>
      sessionMatches(session, deferredQuery, topicFilter),
    );

    return filtered
      .map((session) => {
        const sessionSpeakers = session.speakers.map(speakerName);
        const speakerMatch = sessionSpeakers.some((speaker) =>
          likedSpeakers.includes(speaker),
        );
        const orgMatch = session.organisations.some((org) => likedOrgs.includes(org));
        const assignedDay = session.plannerDay;
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
      })
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
  }, [currentDay, deferredQuery, likedOrgs, likedSpeakers, saved, topicFilter]);

  const visibleSessions = useMemo(() => {
    if (viewMode === "planned") {
      return sessions.filter((session) => session.assignedDay === currentDay && session.isSaved);
    }

    if (viewMode === "recommended") {
      return sessions.filter((session) => session.isRecommended);
    }

    return sessions;
  }, [currentDay, sessions, viewMode]);

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
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile, saved, likedSpeakers, likedOrgs }),
    );
  }, [likedOrgs, likedSpeakers, profile, saved]);

  useEffect(() => {
    const payload = [
      "AWS Summit Sydney",
      ...PROFILE_FIELDS.map(({ key, label }) =>
        profile[key].trim() ? `${label}: ${profile[key].trim()}` : null,
      ).filter(Boolean),
    ].join("\n");

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 256,
      color: {
        dark: "#1b1a17",
        light: "#f7f1e8",
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

  return (
    <div
      className="app-shell"
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
            <a className="outline-link" href={agenda.source.agendaUrl} target="_blank" rel="noreferrer">
              Official agenda
            </a>
          </div>
          <p className="hero-note">{FIXED_TIME_NOTE}</p>

          <div className="day-switcher" aria-label="Planner days">
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
          </div>

          <div className="search-row">
            <input
              aria-label="Search talks"
              className="search-input"
              placeholder="Search title, speaker, org, topic"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Filter by topic"
              className="topic-select"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
            >
              <option value="all">All topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div className="liked-strip">
            <span>Liked</span>
            {[...likedSpeakers, ...likedOrgs].slice(0, 8).map((label) => (
              <span key={label} className="mini-chip">
                {label}
              </span>
            ))}
            {likedSpeakers.length === 0 && likedOrgs.length === 0 ? (
              <span className="muted-copy">Tap a speaker or org on a card to surface related talks.</span>
            ) : null}
          </div>
        </section>

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
                  <span className="level-badge">{session.level}</span>
                  {session.recommendationReason ? (
                    <span className="signal-badge">{session.recommendationReason}</span>
                  ) : null}
                </div>

                <h3>{session.title}</h3>
                <p className="session-type">{session.sessionType}</p>
                <p className="session-description">{session.description}</p>

                <div className="chip-row">
                  {topicsForSession.slice(0, 3).map((topic) => (
                    <span key={topic} className="topic-chip">
                      {topic}
                    </span>
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
                    {session.isSaved ? "Attending" : "Mark attending"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {visibleSessions.length === 0 ? (
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
