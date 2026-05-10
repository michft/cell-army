const DAY_OPTIONS = [
  { id: "day1", label: "Day 1", date: "13 May" },
  { id: "day2", label: "Day 2", date: "14 May" },
];

/** @typedef {import("../types").DayId} DayId */
/** @typedef {import("../types").PlannerSession} PlannerSession */
/** @typedef {import("../types").TimeWindowOption} TimeWindowOption */

/**
 * Toggle a value's presence in an array and return the resulting sorted array.
 * @param {string[]} current - The source array of values.
 * @param {string} value - The value to add if missing or remove if present.
 * @returns {string[]} The updated array: `value` removed if it was present, otherwise added and the array sorted.
 */
function toggleSelection(current, value) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

/**
 * Extracts labels from session tags that belong to the given namespace.
 *
 * @param {{ tags: { namespace: string, label: string }[] }} session - Session object containing a `tags` array.
 * @param {string} namespace - Namespace to filter tags by.
 * @returns {string[]} Array of tag labels whose `namespace` matches the provided `namespace`.
 */
function tagLabels(session, namespace) {
  return session.tags
    .filter((tag) => tag.namespace === namespace)
    .map((tag) => tag.label);
}

/**
 * Extracts the display name from a speaker label, using the text before the first comma.
 * @param {string} label - Speaker label, typically in the form "Last, First" or a single name.
 * @returns {string} The trimmed name before the first comma, or the original label if no comma is present.
 */
function speakerName(label) {
  return label.split(",")[0]?.trim() ?? label;
}

/**
 * Determine the display level code for a session.
 *
 * If `session.code` contains a digit, returns that digit followed by "00" (for example, a code containing "2" yields "200").
 * Otherwise maps `session.level` to one of "100", "200", "300", "400" or "Other", defaulting to "Other" when unmapped.
 *
 * @param {{ code?: string, level: string }} session - Session data; `code` is an optional session code string, `level` is the session's level label used as a fallback.
 * @returns {string} The computed display level code ("100", "200", "300", "400" or "Other").
 */
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
  return LEVEL_LABELS[/** @type {keyof typeof LEVEL_LABELS} */ (session.level)] ?? "Other";
}

/**
 * Render a searchable, filterable grid of session cards with controls for topics, levels, day and time.
 *
 * @param {Object} props - Component props.
 * @param {string[]} props.topics - Available topic labels for the topic filter chips.
 * @param {string[]} props.levels - Available talk level labels for the level filter chips.
 * @param {string} props.query - Current text in the search input.
 * @param {import("react").Dispatch<import("react").SetStateAction<string>>} props.onQueryChange - Handler to update the search query.
 * @param {string[]} props.topicFilters - Currently selected topic filters.
 * @param {import("react").Dispatch<import("react").SetStateAction<string[]>>} props.onTopicFiltersChange - Updater for topic filter selections.
 * @param {string[]} props.levelFilters - Currently selected level filters.
 * @param {import("react").Dispatch<import("react").SetStateAction<string[]>>} props.onLevelFiltersChange - Updater for level filter selections.
 * @param {DayId} props.browseDay - Selected day for the "Fill a gap on" control.
 * @param {import("react").Dispatch<import("react").SetStateAction<DayId>>} props.onBrowseDayChange - Updater for the selected browse day.
 * @param {string} props.timeWindow - Selected time window value.
 * @param {import("react").Dispatch<import("react").SetStateAction<string>>} props.onTimeWindowChange - Updater for the selected time window.
 * @param {TimeWindowOption[]} props.timeWindowOptions - Options presented in the time window select.
 * @param {PlannerSession[]} props.visibleSessions - Sessions to display as cards.
 * @param {string[]} props.likedOrgs - Organisation labels marked as liked.
 * @param {string[]} props.likedSpeakers - Speaker names marked as liked.
 * @param {(sessionId: string) => void} props.onToggleSave - Toggle handler to mark a session as saved/attending.
 * @param {(label: string) => void} props.onToggleLikedOrg - Toggle handler for liking/unliking an organisation.
 * @param {(label: string) => void} props.onToggleLikedSpeaker - Toggle handler for liking/unliking a speaker (receives the original speaker string).
 * @param {() => void} props.onResetPlanner - Handler to reset planner state.
 * @param {number} props.likedOrgsCount - Count of liked organisations.
 * @param {number} props.likedSpeakersCount - Count of liked speakers.
 * @returns {JSX.Element} The rendered Browse screen component.
 */
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
                    onClick={() => onBrowseDayChange(/** @type {DayId} */ (day.id))}
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
