export type DayId = "day1" | "day2";

export interface Profile {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
}

export type SavedSessions = Set<string>;

export interface StoredState {
  profile: Profile;
  saved: string[];
  likedSpeakers: string[];
  likedOrgs: string[];
}

export interface SessionTag {
  namespace: string;
  label: string;
  description?: string;
}

export interface AgendaSession {
  id: string;
  code: string;
  title: string;
  sessionType: string;
  level: string;
  language?: string;
  organisations: string[];
  speakers: string[];
  description: string;
  registerUrl?: string;
  startTime?: string;
  endTime?: string;
  tags: SessionTag[];
  plannerDay?: DayId;
}

export interface PlannerSession extends AgendaSession {
  assignedDay: DayId;
  isSaved: boolean;
  isRecommended: boolean;
  recommendationReason: string;
}

export interface TimeWindowOption {
  value: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
}

export interface DayOption {
  id: DayId;
  label: string;
  date: string;
}

export interface DayStat extends DayOption {
  planned: number;
}
