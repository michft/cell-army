import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { Dispatch, ReactElement, SetStateAction, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardTypeOptions,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import agenda from "./data/sessions.json";
import type { AgendaSession, DayId, DayStat, PlannerSession, Profile, TimeWindowOption } from "./types";
import { DAY_OPTIONS, sessionLevelCode, speakerName, tagLabels, toggleSelection } from "./utils/session";

type StoredPlannerState = {
  profile?: Partial<Profile>;
  qrMode?: QRMode;
  webLink?: string;
  saved?: string[];
  likedSpeakers?: string[];
  likedOrgs?: string[];
};

type QRMode = "contact" | "webLink" | "cellArmy";

type ProfileField = {
  key: keyof Profile;
  label: string;
  placeholder: string;
  keyboardType: KeyboardTypeOptions;
};

type ChipProps = {
  active?: boolean;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
};

type ButtonProps = {
  active?: boolean;
  label: string;
  onPress: () => void;
};

type IntroProps = {
  currentDay: DayId;
  dayStats: DayStat[];
  onChangeDay: Dispatch<SetStateAction<DayId>>;
};

type QRProps = {
  profile: Profile;
  onProfileChange: Dispatch<SetStateAction<Profile>>;
  qrMode: QRMode;
  onQrModeChange: Dispatch<SetStateAction<QRMode>>;
  webLink: string;
  onWebLinkChange: Dispatch<SetStateAction<string>>;
};

type BrowseProps = {
  browseDay: DayId;
  levelFilters: string[];
  levels: string[];
  likedOrgs: string[];
  likedOrgsCount: number;
  likedSpeakers: string[];
  likedSpeakersCount: number;
  onBrowseDayChange: Dispatch<SetStateAction<DayId>>;
  onLevelFiltersChange: Dispatch<SetStateAction<string[]>>;
  onQueryChange: Dispatch<SetStateAction<string>>;
  onResetPlanner: () => void;
  onTimeWindowChange: Dispatch<SetStateAction<string>>;
  onToggleLikedOrg: (label: string) => void;
  onToggleLikedSpeaker: (label: string) => void;
  onToggleSave: (sessionId: string) => void;
  onTopicFiltersChange: Dispatch<SetStateAction<string[]>>;
  query: string;
  timeWindow: string;
  timeWindowOptions: TimeWindowOption[];
  topicFilters: string[];
  topics: string[];
  visibleSessions: PlannerSession[];
};

type SessionCardProps = BrowseProps & {
  session: PlannerSession;
};

type CalendarProps = {
  currentDay: DayId;
  onBrowseTime: (session: PlannerSession) => void;
  onChangeDay: Dispatch<SetStateAction<DayId>>;
  onToggleSave: (sessionId: string) => void;
  sessions: PlannerSession[];
};

const APP_TITLE = process.env.EXPO_PUBLIC_APP_TITLE || "AWS Summit Sydney Planner";
const AGENDA_URL = process.env.EXPO_PUBLIC_AGENDA_URL || agenda.source.agendaUrl;
const CELL_ARMY_URL = "https://cell-army.vercel.app/";
const STORAGE_KEY = "aws-summit-sydney-planner";
const SCREEN_TABS = ["Intro", "QR", "Browse", "Calendar"];
const DEFAULT_PROFILE: Profile = { name: "", role: "", company: "", email: "", phone: "" };
const PROFILE_FIELDS: ProfileField[] = [
  { key: "name", label: "Name", placeholder: "Your name", keyboardType: "default" },
  { key: "role", label: "Role", placeholder: "Your role", keyboardType: "default" },
  { key: "company", label: "Company", placeholder: "Your company", keyboardType: "default" },
  { key: "email", label: "Email", placeholder: "you@example.com", keyboardType: "email-address" },
  { key: "phone", label: "Phone", placeholder: "+61 4xx xxx xxx", keyboardType: "phone-pad" },
];
const FIXED_TIME_NOTE =
  "Sessions run at fixed summit times. This app helps you browse each day, mark the talks you plan to attend, and highlight future talks from speakers or organisations you liked.";

const agendaSessions = agenda.sessions as AgendaSession[];

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildVcard(profile: Profile): string {
  const name = profile.name.trim();
  const role = profile.role.trim();
  const company = profile.company.trim();
  const email = profile.email.trim();
  const phone = profile.phone.trim();

  return [
    "BEGIN:VCARD",
    "VERSION:2.0",
    ...(name ? [`FN:${escapeIcs(name)}`] : []),
    ...(role ? [`TITLE:${escapeIcs(role)}`] : []),
    ...(company ? [`ORG:${escapeIcs(company)}`] : []),
    ...(email ? [`EMAIL:${escapeIcs(email)}`] : []),
    ...(phone ? [`TEL:${escapeIcs(phone)}`] : []),
    "END:VCARD",
  ].join("\r\n");
}

function buildWebLinkPayload(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseQrMode(value: QRMode | undefined): QRMode {
  if (value === "webLink" || value === "cellArmy") return value;
  return "contact";
}

function sessionPlannerDay(session: AgendaSession): DayId {
  const taggedDay = session.tags.find(
    (tag) => tag.namespace === "GLOBAL#local-tags-aws-summit-anz-event-day",
  )?.label;

  if (taggedDay === "event-day-01") return "day1";
  if (taggedDay === "event-day-02") return "day2";
  return session.plannerDay ?? "day1";
}

function parseTimeValue(time: string | undefined): number | null {
  if (typeof time !== "string") return null;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

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

function formatWindowLabel(startMinutes: number, isLastWindow: boolean): string {
  const startHours = String(Math.floor(startMinutes / 60)).padStart(2, "0");
  if (isLastWindow) return `${startHours}:00+`;
  const endHours = String(Math.floor((startMinutes + 60) / 60)).padStart(2, "0");
  return `${startHours}:00-${endHours}:00`;
}

function buildTimeWindowOptions(sessions: AgendaSession[], dayId: DayId): TimeWindowOption[] {
  const starts = sessions
    .filter((session) => sessionPlannerDay(session) === dayId)
    .flatMap((session) => [parseTimeValue(session.startTime), parseTimeValue(session.endTime)])
    .filter((value): value is number => value !== null);

  if (starts.length === 0) return [];

  const firstHour = Math.floor(Math.min(...starts) / 60) * 60;
  const lastHour = Math.floor((Math.max(...starts) - 1) / 60) * 60;
  const windows: TimeWindowOption[] = [];

  for (let startMinutes = firstHour; startMinutes <= lastHour; startMinutes += 60) {
    const endMinutes = startMinutes + 60;
    const hasOverlap = sessions.some((session) => {
      if (sessionPlannerDay(session) !== dayId) return false;
      const sessionStart = parseTimeValue(session.startTime);
      const sessionEnd = parseTimeValue(session.endTime);
      return sessionStart !== null && sessionEnd !== null && sessionStart < endMinutes && sessionEnd > startMinutes;
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

function timeWindowValueForSession(session: PlannerSession): string {
  const startMinutes = parseTimeValue(session.startTime);
  if (startMinutes === null) return "";
  const windowStart = Math.floor(startMinutes / 60) * 60;
  return `${windowStart}-${windowStart + 60}`;
}

function sessionMatches(session: AgendaSession, query: string, topicFilters: string[], levelFilters: string[]): boolean {
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

function formatTime(time: string | undefined): string {
  return time || "";
}

function formatSessionTime(session: PlannerSession): string {
  if (!session.startTime || !session.endTime) return "";
  const day = DAY_OPTIONS.find((option) => option.id === session.assignedDay);
  return `${day ? `${day.label} - ${day.date} · ` : ""}${session.startTime} - ${session.endTime}`;
}

function clampLookAheadMinutes(value: number): number {
  return Math.max(1, Math.min(120, value));
}

function sessionStartDate(session: PlannerSession): Date | null {
  const dayIndex = DAY_OPTIONS.findIndex((day) => day.id === session.assignedDay);
  const date = agenda.event.dates[dayIndex];
  const startMinutes = parseTimeValue(session.startTime);
  if (!date || startMinutes === null) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, Math.floor(startMinutes / 60), startMinutes % 60);
}

function sessionEndDate(session: PlannerSession): Date | null {
  const dayIndex = DAY_OPTIONS.findIndex((day) => day.id === session.assignedDay);
  const date = agenda.event.dates[dayIndex];
  const endMinutes = parseTimeValue(session.endTime);
  if (!date || endMinutes === null) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, Math.floor(endMinutes / 60), endMinutes % 60);
}

function useSwipe(onSwipe: (direction: number) => void) {
  const start = useRef({ x: 0, y: 0 });
  const onSwipeRef = useRef(onSwipe);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: (_, gesture) => {
        start.current = { x: gesture.x0, y: gesture.y0 };
      },
      onPanResponderRelease: (_, gesture) => {
        const deltaX = gesture.moveX - start.current.x;
        const deltaY = gesture.moveY - start.current.y;
        if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        onSwipeRef.current(deltaX < 0 ? 1 : -1);
      },
    }),
  );

  onSwipeRef.current = onSwipe;
  return panResponder.current;
}

function Chip({ active = false, label, onPress, tone = "default" }: ChipProps): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, tone === "danger" && styles.chipDanger]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ active = false, label, onPress }: ButtonProps): ReactElement {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, active && styles.primaryButtonActive]}>
      <Text style={[styles.primaryButtonText, active && styles.primaryButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function IntroScreen({ currentDay, dayStats, onChangeDay }: IntroProps): ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Portrait planner</Text>
        <Text style={styles.title}>{agenda.event.name}</Text>
        <Text style={styles.meta}>
          {DAY_OPTIONS.find((day) => day.id === currentDay)?.date} · {agenda.event.venue}
        </Text>
        <Text style={styles.copy}>{FIXED_TIME_NOTE}</Text>

        <View style={styles.dayGrid}>
          {dayStats.map((day) => (
            <Pressable
              key={day.id}
              onPress={() => onChangeDay(day.id)}
              style={[styles.dayPill, day.id === currentDay && styles.dayPillActive]}
            >
              <Text style={[styles.dayLabel, day.id === currentDay && styles.dayLabelActive]}>{day.label}</Text>
              <Text style={[styles.dayCount, day.id === currentDay && styles.dayLabelActive]}>{day.planned}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="Open AWS agenda" onPress={() => Linking.openURL(AGENDA_URL)} />
      </View>
    </ScrollView>
  );
}

function QRScreen({ profile, onProfileChange, qrMode, onQrModeChange, webLink, onWebLinkChange }: QRProps): ReactElement {
  const vcardPayload = useMemo(() => buildVcard(profile), [profile]);
  const webLinkPayload = useMemo(() => buildWebLinkPayload(webLink), [webLink]);
  const qrPayload = qrMode === "contact" ? vcardPayload : qrMode === "cellArmy" ? CELL_ARMY_URL : webLinkPayload;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: qrMode === "contact" }}
            onPress={() => onQrModeChange("contact")}
            style={[styles.segment, qrMode === "contact" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, qrMode === "contact" && styles.segmentTextActive]}>Contact</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: qrMode === "webLink" }}
            onPress={() => onQrModeChange("webLink")}
            style={[styles.segment, qrMode === "webLink" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, qrMode === "webLink" && styles.segmentTextActive]}>Web link</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: qrMode === "cellArmy" }}
            onPress={() => onQrModeChange("cellArmy")}
            style={[styles.segment, qrMode === "cellArmy" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, qrMode === "cellArmy" && styles.segmentTextActive]}>Cell Army</Text>
          </Pressable>
        </View>

        <View style={styles.qrBox}>
          {qrPayload ? (
            <QRCode value={qrPayload} size={220} color="#ffad32" backgroundColor="#151922" />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.centerCopy}>Enter a web link to generate a QR code.</Text>
            </View>
          )}
        </View>
        {qrMode === "contact" ? <Text style={styles.centerCopy}>Show this when someone asks who you are :)</Text> : null}

        {qrMode === "cellArmy" ? (
          <View style={styles.field}>
            <Text style={styles.label}>Cell Army</Text>
            <Text style={styles.muted}>{CELL_ARMY_URL}</Text>
          </View>
        ) : qrMode === "contact" ? (
          <View style={styles.form}>
            {PROFILE_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  autoCapitalize={field.key === "email" ? "none" : "sentences"}
                  keyboardType={field.keyboardType}
                  onChangeText={(value) => onProfileChange((current) => ({ ...current, [field.key]: value }))}
                  placeholder={field.placeholder}
                  placeholderTextColor="#747b88"
                  style={styles.input}
                  value={profile[field.key]}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Web link</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={onWebLinkChange}
              placeholder="https://example.com"
              placeholderTextColor="#747b88"
              style={styles.input}
              value={webLink}
            />
            {webLink.trim() && webLinkPayload !== webLink.trim() ? (
              <Text style={styles.muted}>QR payload: {webLinkPayload}</Text>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SessionCard({
  session,
  likedOrgs,
  likedSpeakers,
  levelFilters,
  onLevelFiltersChange,
  onToggleLikedOrg,
  onToggleLikedSpeaker,
  onToggleSave,
  topicFilters,
  onTopicFiltersChange,
}: SessionCardProps): ReactElement {
  const topicsForSession = tagLabels(session, "GLOBAL#aws-technology-categories");
  const levelCode = sessionLevelCode(session);
  const sessionTime = formatSessionTime(session);

  return (
    <View style={[styles.sessionCard, session.isRecommended && styles.recommendedCard]}>
      <View style={styles.cardTopline}>
        <Text style={styles.codeBadge}>{session.code}</Text>
        <Chip active={levelFilters.includes(levelCode)} label={levelCode} onPress={() => onLevelFiltersChange((current) => toggleSelection(current, levelCode))} />
      </View>
      {session.recommendationReason ? <Text style={styles.signal}>{session.recommendationReason}</Text> : null}
      <Text style={styles.sessionTitle}>{session.title}</Text>
      {sessionTime ? <Text style={styles.calendarTime}>{sessionTime}</Text> : null}
      <Text style={styles.sessionType}>{session.sessionType}</Text>
      <Text numberOfLines={5} style={styles.description}>
        {session.description}
      </Text>

      <View style={styles.wrapRow}>
        {topicsForSession.slice(0, 3).map((topic) => (
          <Chip key={topic} active={topicFilters.includes(topic)} label={topic} onPress={() => onTopicFiltersChange((current) => toggleSelection(current, topic))} />
        ))}
      </View>

      <View style={styles.wrapRow}>
        {session.organisations.map((org, index) => (
          <Chip key={`${session.id}-org-${org}-${index}`} active={likedOrgs.includes(org)} label={org} onPress={() => onToggleLikedOrg(org)} />
        ))}
      </View>

      <View style={styles.wrapRow}>
        {session.speakers.map((speaker, index) => {
          const name = speakerName(speaker);
          return <Chip key={`${session.id}-speaker-${speaker}-${index}`} active={likedSpeakers.includes(name)} label={name} onPress={() => onToggleLikedSpeaker(speaker)} />;
        })}
      </View>

      <PrimaryButton active={session.isSaved} label={session.isSaved ? "Attending" : "Add"} onPress={() => onToggleSave(session.id)} />
    </View>
  );
}

function BrowseScreen(props: BrowseProps): ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <TextInput
          accessibilityLabel="Search talks"
          onChangeText={props.onQueryChange}
          placeholder="Search title, speaker, org, topic"
          placeholderTextColor="#747b88"
          style={styles.input}
          value={props.query}
        />

        <Text style={styles.label}>Topics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
          {props.topics.map((topic) => (
            <Chip key={topic} active={props.topicFilters.includes(topic)} label={topic} onPress={() => props.onTopicFiltersChange((current) => toggleSelection(current, topic))} />
          ))}
        </ScrollView>

        <Text style={styles.label}>Talk level</Text>
        <View style={styles.wrapRow}>
          {props.levels.map((level) => (
            <Chip key={level} active={props.levelFilters.includes(level)} label={level} onPress={() => props.onLevelFiltersChange((current) => toggleSelection(current, level))} />
          ))}
        </View>

        <Text style={styles.label}>Fill a gap on</Text>
        <View style={styles.wrapRow}>
          {DAY_OPTIONS.map((day) => (
            <Chip key={day.id} active={props.browseDay === day.id} label={day.label} onPress={() => props.onBrowseDayChange(day.id)} />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
          <Chip active={!props.timeWindow} label="Any time" onPress={() => props.onTimeWindowChange("")} />
          {props.timeWindowOptions.map((option) => (
            <Chip key={option.value} active={props.timeWindow === option.value} label={option.label} onPress={() => props.onTimeWindowChange(option.value)} />
          ))}
        </ScrollView>

        <View style={styles.toolbarFooter}>
          <Text style={styles.muted}>
            {props.visibleSessions.length} talks · {props.likedSpeakersCount + props.likedOrgsCount} liked signals
          </Text>
          <Chip label="Reset" onPress={props.onResetPlanner} tone="danger" />
        </View>
      </View>

      {props.visibleSessions.map((session) => (
        <SessionCard key={session.id} session={session} {...props} />
      ))}

      {props.visibleSessions.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>No talks match this view</Text>
          <Text style={styles.copy}>Try another topic, clear the search, or like a speaker first.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function CalendarScreen({ currentDay, onBrowseTime, onChangeDay, onToggleSave, sessions }: CalendarProps): ReactElement {
  const [selectedSession, setSelectedSession] = useState<PlannerSession | null>(null);
  const [lookAheadMinutes, setLookAheadMinutes] = useState(30);
  const currentDayData = sessions
    .filter((session) => session.assignedDay === currentDay && session.startTime && session.endTime)
    .sort((left, right) => `${left.startTime}${left.title}`.localeCompare(`${right.startTime}${right.title}`));
  const selectedSessions = currentDayData.filter((session) => session.isSaved);
  const now = new Date();
  const upcomingWindowEnd = new Date(now.getTime() + lookAheadMinutes * 60 * 1000);
  const upcomingSessions = currentDayData.filter((session) => {
    if (session.isSaved) return false;
    const startsAt = sessionStartDate(session);
    const endsAt = sessionEndDate(session);
    return startsAt !== null && endsAt !== null && startsAt <= upcomingWindowEnd && endsAt >= now;
  });

  useEffect(() => {
    if (!selectedSession) return;
    const updated = selectedSessions.find((session) => session.id === selectedSession.id);
    if (!updated) setSelectedSession(null);
    else setSelectedSession(updated);
  }, [selectedSession, selectedSessions]);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2-Day Schedule</Text>
        <View style={styles.wrapRow}>
          {DAY_OPTIONS.map((day) => (
            <Chip key={day.id} active={currentDay === day.id} label={`${day.label} - ${day.date}`} onPress={() => onChangeDay(day.id)} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Sessions in your schedule</Text>
        {selectedSessions.length === 0 ? (
          <Text style={styles.copy}>No sessions scheduled yet. Add fixed-time talks from Browse or the upcoming list below.</Text>
        ) : (
          selectedSessions.map((session) => (
            <Pressable key={session.id} onPress={() => setSelectedSession(session)} style={styles.calendarItem}>
              <Text style={styles.calendarTime}>
                {formatTime(session.startTime)} - {formatTime(session.endTime)}
              </Text>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionType}>{session.code} · {session.sessionType}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Add sessions occurring soon</Text>
        <View style={styles.lookAheadControl}>
          <Text style={styles.muted}>Next</Text>
          <TextInput
            accessibilityLabel="Upcoming sessions time window in minutes"
            keyboardType="number-pad"
            onChangeText={(value) => {
              const parsed = Number(value.replace(/[^\d]/g, ""));
              if (Number.isFinite(parsed) && parsed > 0) setLookAheadMinutes(clampLookAheadMinutes(parsed));
            }}
            style={[styles.input, styles.minutesInput]}
            value={String(lookAheadMinutes)}
          />
          <Text style={styles.muted}>minutes</Text>
        </View>
        <View style={styles.wrapRow}>
          {[15, 30, 60, 120].map((minutes) => (
            <Chip
              key={minutes}
              active={lookAheadMinutes === minutes}
              label={`${minutes} min`}
              onPress={() => setLookAheadMinutes(minutes)}
            />
          ))}
        </View>
        <Text style={styles.muted}>{upcomingSessions.length} sessions in the next {lookAheadMinutes} minutes</Text>
        {upcomingSessions.length === 0 ? (
          <Text style={styles.copy}>No unscheduled sessions occur in that window for this day.</Text>
        ) : null}
        {upcomingSessions.map((session) => (
          <View key={session.id} style={styles.availableItem}>
            <Text style={styles.calendarTime}>
              {formatTime(session.startTime)} - {formatTime(session.endTime)} · {session.code}
            </Text>
            <Text style={styles.availableTitle}>{session.title}</Text>
            <PrimaryButton label="Add" onPress={() => onToggleSave(session.id)} />
          </View>
        ))}
      </View>

      <Modal animationType="fade" transparent visible={Boolean(selectedSession)} onRequestClose={() => setSelectedSession(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedSession ? (
              <>
                <Text style={styles.eyebrow}>Scheduled session</Text>
                <Text style={styles.sectionTitle}>{selectedSession.title}</Text>
                <Text style={styles.calendarTime}>
                  {selectedSession.code} · {formatTime(selectedSession.startTime)} - {formatTime(selectedSession.endTime)}
                </Text>
                <ScrollView style={styles.modalCopy}>
                  <Text style={styles.copy}>{selectedSession.description}</Text>
                  {selectedSession.speakers.length ? (
                    <>
                      <Text style={styles.label}>Speakers</Text>
                      <Text style={styles.copy}>{selectedSession.speakers.join(", ")}</Text>
                    </>
                  ) : null}
                  {selectedSession.organisations.length ? (
                    <>
                      <Text style={styles.label}>Organisations</Text>
                      <Text style={styles.copy}>{selectedSession.organisations.join(", ")}</Text>
                    </>
                  ) : null}
                </ScrollView>
                <View style={styles.modalActions}>
                  <PrimaryButton
                    label="Browse this time"
                    onPress={() => {
                      onBrowseTime(selectedSession);
                      setSelectedSession(null);
                    }}
                  />
                  <PrimaryButton
                    active
                    label="Remove from schedule"
                    onPress={() => {
                      onToggleSave(selectedSession.id);
                      setSelectedSession(null);
                    }}
                  />
                  <Chip label="Close" onPress={() => setSelectedSession(null)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

export default function App(): ReactElement {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [screenIndex, setScreenIndex] = useState(0);
  const [currentDay, setCurrentDay] = useState<DayId>("day1");
  const [browseDay, setBrowseDay] = useState<DayId>("day1");
  const [query, setQuery] = useState("");
  const [topicFilters, setTopicFilters] = useState<string[]>([]);
  const [levelFilters, setLevelFilters] = useState<string[]>([]);
  const [timeWindow, setTimeWindow] = useState("");
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [qrMode, setQrMode] = useState<QRMode>("contact");
  const [webLink, setWebLink] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [likedSpeakers, setLikedSpeakers] = useState<string[]>([]);
  const [likedOrgs, setLikedOrgs] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    let mounted = true;
    async function hydrate(): Promise<void> {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as StoredPlannerState) : null;
        if (!mounted || !parsed) return;
        setProfile({ ...DEFAULT_PROFILE, ...parsed.profile });
        setQrMode(parseQrMode(parsed.qrMode));
        setWebLink(parsed.webLink ?? "");
        setSaved(new Set(parsed.saved ?? []));
        setLikedSpeakers(parsed.likedSpeakers ?? []);
        setLikedOrgs(parsed.likedOrgs ?? []);
      } finally {
        if (mounted) setIsStorageReady(true);
      }
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageReady) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile, qrMode, webLink, saved: Array.from(saved), likedSpeakers, likedOrgs }),
    ).catch((error) => {
      console.warn("Failed to persist planner state:", error);
    });
  }, [isStorageReady, likedOrgs, likedSpeakers, profile, qrMode, saved, webLink]);

  const topics = useMemo(
    () =>
      Array.from(new Set(agendaSessions.flatMap((session) => tagLabels(session, "GLOBAL#aws-technology-categories")))).sort(),
    [],
  );
  const levels = useMemo(() => Array.from(new Set(agendaSessions.map((session) => sessionLevelCode(session)))).sort(), []);
  const timeWindowOptions = useMemo(() => buildTimeWindowOptions(agendaSessions, browseDay), [browseDay]);

  const sessions = useMemo<PlannerSession[]>(() => {
    const filtered = agendaSessions.filter((session) => sessionMatches(session, deferredQuery, topicFilters, levelFilters));
    return filtered.map((session) => {
      const sessionSpeakers = session.speakers.map(speakerName);
      const speakerMatch = sessionSpeakers.some((speaker) => likedSpeakers.includes(speaker));
      const orgMatch = session.organisations.some((org) => likedOrgs.includes(org));
      return {
        ...session,
        assignedDay: sessionPlannerDay(session),
        isSaved: saved.has(session.id),
        isRecommended: speakerMatch || orgMatch,
        recommendationReason: speakerMatch ? "Liked speaker" : orgMatch ? "Liked organisation" : "",
      };
    });
  }, [deferredQuery, levelFilters, likedOrgs, likedSpeakers, saved, topicFilters]);

  const visibleSessions = useMemo<PlannerSession[]>(() => {
    const alphabetized = [...sessions].sort((left, right) => left.title.localeCompare(right.title));
    return alphabetized.filter((session) => {
      if (session.assignedDay !== browseDay) return false;
      if (!timeWindow) return true;
      const [windowStart, windowEnd] = timeWindow.split("-").map(Number);
      const sessionStart = parseTimeValue(session.startTime);
      const sessionEnd = parseTimeValue(session.endTime);
      return sessionStart !== null && sessionEnd !== null && sessionStart < windowEnd && sessionEnd > windowStart;
    });
  }, [browseDay, sessions, timeWindow]);

  const dayStats = useMemo<DayStat[]>(
    () =>
      DAY_OPTIONS.map((day) => ({
        ...day,
        planned: sessions.filter((session) => session.assignedDay === day.id && session.isSaved).length,
      })),
    [sessions],
  );

  useEffect(() => {
    if (timeWindow && !timeWindowOptions.some((option) => option.value === timeWindow)) setTimeWindow("");
  }, [timeWindow, timeWindowOptions]);

  function toggleSave(sessionId: string): void {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function toggleLikedSpeaker(label: string): void {
    const name = speakerName(label);
    setLikedSpeakers((current) =>
      current.includes(name) ? current.filter((value) => value !== name) : [...current, name].sort(),
    );
  }

  function toggleLikedOrg(label: string): void {
    setLikedOrgs((current) =>
      current.includes(label) ? current.filter((value) => value !== label) : [...current, label].sort(),
    );
  }

  function resetPlanner(): void {
    Alert.alert("Reset planner?", "Reset your filters, likes, and full saved schedule?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setQuery("");
          setTopicFilters([]);
          setLevelFilters([]);
          setTimeWindow("");
          setSaved(new Set());
          setLikedSpeakers([]);
          setLikedOrgs([]);
          setCurrentDay("day1");
          setBrowseDay("day1");
        },
      },
    ]);
  }

  function browseSessionsForTime(session: PlannerSession): void {
    setBrowseDay(session.assignedDay);
    setCurrentDay(session.assignedDay);
    setTimeWindow(timeWindowValueForSession(session));
    setScreenIndex(2);
  }

  const screenSwipe = useSwipe((direction) => {
    setScreenIndex((current) => Math.max(0, Math.min(SCREEN_TABS.length - 1, current + direction)));
  });

  const screens = [
    <IntroScreen currentDay={currentDay} dayStats={dayStats} onChangeDay={setCurrentDay} />,
    <QRScreen
      onProfileChange={setProfile}
      onQrModeChange={setQrMode}
      onWebLinkChange={setWebLink}
      profile={profile}
      qrMode={qrMode}
      webLink={webLink}
    />,
    <BrowseScreen
      browseDay={browseDay}
      levelFilters={levelFilters}
      levels={levels}
      likedOrgs={likedOrgs}
      likedOrgsCount={likedOrgs.length}
      likedSpeakers={likedSpeakers}
      likedSpeakersCount={likedSpeakers.length}
      onBrowseDayChange={setBrowseDay}
      onLevelFiltersChange={setLevelFilters}
      onQueryChange={setQuery}
      onResetPlanner={resetPlanner}
      onTimeWindowChange={setTimeWindow}
      onToggleLikedOrg={toggleLikedOrg}
      onToggleLikedSpeaker={toggleLikedSpeaker}
      onToggleSave={toggleSave}
      onTopicFiltersChange={setTopicFilters}
      query={query}
      timeWindow={timeWindow}
      timeWindowOptions={timeWindowOptions}
      topicFilters={topicFilters}
      topics={topics}
      visibleSessions={visibleSessions}
    />,
    <CalendarScreen
      currentDay={currentDay}
      onBrowseTime={browseSessionsForTime}
      onChangeDay={setCurrentDay}
      onToggleSave={toggleSave}
      sessions={sessions}
    />,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>{APP_TITLE}</Text>
        <Text style={styles.appSubtitle}>Snapshot refreshed {new Date(agenda.source.fetchedAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.tabs}>
        {SCREEN_TABS.map((label, index) => (
          <Pressable key={label} onPress={() => setScreenIndex(index)} style={[styles.tab, screenIndex === index && styles.tabActive]}>
            <Text style={[styles.tabText, screenIndex === index && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.content} {...screenSwipe.panHandlers}>
        {screens[screenIndex]}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0f1218" },
  appHeader: { paddingHorizontal: 16, paddingBottom: 10, paddingTop: 8 },
  appTitle: { color: "#f6f1e8", fontSize: 18, fontWeight: "800" },
  appSubtitle: { color: "#9299a6", fontSize: 12, marginTop: 3 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  tab: { flex: 1, borderColor: "#2a303b", borderRadius: 8, borderWidth: 1, paddingVertical: 9 },
  tabActive: { backgroundColor: "#ffad32", borderColor: "#ffad32" },
  tabText: { color: "#c9d0dc", fontSize: 12, fontWeight: "700", textAlign: "center" },
  tabTextActive: { color: "#19140c" },
  content: { flex: 1 },
  screen: { gap: 14, padding: 14, paddingBottom: 36 },
  hero: { backgroundColor: "#151922", borderRadius: 8, gap: 14, padding: 18 },
  card: { backgroundColor: "#151922", borderColor: "#252b36", borderRadius: 8, borderWidth: 1, gap: 12, padding: 14 },
  eyebrow: { color: "#ffad32", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  title: { color: "#f7f2e9", fontSize: 32, fontWeight: "900", lineHeight: 37 },
  sectionTitle: { color: "#f7f2e9", fontSize: 20, fontWeight: "800" },
  meta: { color: "#d4d9e2", fontSize: 15, fontWeight: "700" },
  copy: { color: "#c2c8d3", fontSize: 14, lineHeight: 21 },
  centerCopy: { color: "#c2c8d3", fontSize: 14, lineHeight: 21, textAlign: "center" },
  muted: { color: "#9299a6", fontSize: 13 },
  dayGrid: { flexDirection: "row", gap: 10 },
  dayPill: { flex: 1, backgroundColor: "#0f1218", borderColor: "#303744", borderRadius: 8, borderWidth: 1, padding: 14 },
  dayPillActive: { backgroundColor: "#ffad32", borderColor: "#ffad32" },
  dayLabel: { color: "#c9d0dc", fontWeight: "800" },
  dayLabelActive: { color: "#17120a" },
  dayCount: { color: "#f7f2e9", fontSize: 28, fontWeight: "900", marginTop: 4 },
  primaryButton: { alignItems: "center", backgroundColor: "#f7f2e9", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  primaryButtonActive: { backgroundColor: "#ffad32" },
  primaryButtonText: { color: "#151922", fontWeight: "900" },
  primaryButtonTextActive: { color: "#151922" },
  segmentedControl: { backgroundColor: "#0f1218", borderColor: "#303744", borderRadius: 8, borderWidth: 1, flexDirection: "row", padding: 3 },
  segment: { alignItems: "center", borderRadius: 6, flex: 1, paddingVertical: 9 },
  segmentActive: { backgroundColor: "#ffad32" },
  segmentText: { color: "#c9d0dc", fontSize: 13, fontWeight: "900" },
  segmentTextActive: { color: "#17120a" },
  qrBox: { alignItems: "center", backgroundColor: "#0f1218", borderRadius: 8, padding: 18 },
  qrPlaceholder: { alignItems: "center", height: 220, justifyContent: "center", width: 220 },
  form: { gap: 10 },
  field: { gap: 6 },
  label: { color: "#f7f2e9", fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: "#0f1218",
    borderColor: "#303744",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f7f2e9",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  horizontalChips: { marginHorizontal: -2 },
  lookAheadControl: { alignItems: "center", flexDirection: "row", gap: 8 },
  minutesInput: { minWidth: 76, paddingVertical: 8, textAlign: "center" },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#0f1218",
    borderColor: "#303744",
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#ffad32", borderColor: "#ffad32" },
  chipDanger: { borderColor: "#7b3843" },
  chipText: { color: "#c9d0dc", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#17120a" },
  toolbarFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sessionCard: { backgroundColor: "#151922", borderColor: "#252b36", borderRadius: 8, borderWidth: 1, gap: 10, padding: 14 },
  recommendedCard: { borderColor: "#ffad32" },
  cardTopline: { alignItems: "center", flexDirection: "row", gap: 8 },
  codeBadge: {
    backgroundColor: "#26303e",
    borderRadius: 6,
    color: "#f7f2e9",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  signal: { color: "#ffad32", fontSize: 12, fontWeight: "800" },
  sessionTitle: { color: "#f7f2e9", fontSize: 17, fontWeight: "800", lineHeight: 22 },
  sessionType: { color: "#9299a6", fontSize: 13, fontWeight: "700" },
  description: { color: "#c2c8d3", fontSize: 13, lineHeight: 19 },
  calendarItem: { backgroundColor: "#0f1218", borderColor: "#303744", borderRadius: 8, borderWidth: 1, gap: 5, padding: 12 },
  availableItem: { borderTopColor: "#252b36", borderTopWidth: 1, gap: 8, paddingTop: 12 },
  availableTitle: { color: "#f7f2e9", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  calendarTime: { color: "#ffad32", fontSize: 12, fontWeight: "900" },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.72)", flex: 1, justifyContent: "center", padding: 16 },
  modalCard: {
    backgroundColor: "#151922",
    borderColor: "#303744",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    maxHeight: "86%",
    padding: 16,
    width: "100%",
  },
  modalCopy: { maxHeight: 260 },
  modalActions: { gap: 8 },
});
