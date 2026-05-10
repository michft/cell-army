const DAY_OPTIONS = [
  { id: "day1", label: "Day 1", date: "13 May" },
  { id: "day2", label: "Day 2", date: "14 May" },
];

function toggleSelection(current, value) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

function tagLabels(session, namespace) {
  return session.tags
    .filter((tag) => tag.namespace === namespace)
    .map((tag) => tag.label);
}

function speakerName(label) {
  return label.split(",")[0]?.trim() ?? label;
}

function sessionLevelCode(session) {
  const LEVEL_LABELS = {
    foundational: "100",
    intermediate: "200",
    advanced: "300",
    expert: "400",
    unspecified: "Other",
  };
  const codeMatch = session.code?.match(/(\d)/);
  if (codeMatch) {
    return `${codeMatch[1]}00`;
  }
  return LEVEL_LABELS[session.level] ?? "Other";
}

export default function BrowseScreen({
  topics,
  levels,
  query,
  onQueryChange,
  topicFilters,
  onTopicFiltersChange,
  levelFilters,
  onLevelFiltersChange,
  browseDay,
  onBrowseDayChange,
  timeWindow,
  onTimeWindowChange,
  timeWindowOptions,
  visibleSessions,
  likedOrgs,
  likedSpeakers,
  onToggleSave,
  onToggleLikedOrg,
  onToggleLikedSpeaker,
  onResetPlanner,
  likedOrgsCount,
  likedSpeakersCount,
}) {
  return (
    <div className="carousel-screen">
      <section className="toolbar-card">
        <div className="search-row">
          <input
            aria-label="Search talks"
            className="search-input"
            placeholder="Search title, speaker, org, topic"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

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
                    onTopicFiltersChange((current) => toggleSelection(current, topic))
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
                    onLevelFiltersChange((current) => toggleSelection(current, level))
                  }
                  type="button"
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <div className="gap-filter-header">
              <span className="filter-label">Fill a gap on</span>
              <div className="chip-row">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day.id}
                    className={browseDay === day.id ? "topic-chip is-active" : "topic-chip"}
                    onClick={() => onBrowseDayChange(day.id)}
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
              onChange={(event) => onTimeWindowChange(event.target.value)}
            >
              <option value="">Any time</option>
              {timeWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
          {likedSpeakersCount === 0 && likedOrgsCount === 0 ? (
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
                <button
                  className={
                    levelFilters.includes(sessionLevelCode(session))
                      ? "level-badge is-active"
                      : "level-badge"
                  }
                  onClick={() =>
                    onLevelFiltersChange((current) =>
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
                      onTopicFiltersChange((current) => toggleSelection(current, topic))
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
                    onClick={() => onToggleLikedOrg(org)}
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
                        onClick={() => onToggleLikedSpeaker(speaker)}
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
                  onClick={() => onToggleSave(session.id)}
                  type="button"
                >
                  {session.isSaved ? "Attending" : "Add"}
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
    </div>
  );
}
