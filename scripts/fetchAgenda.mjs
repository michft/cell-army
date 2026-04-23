import { mkdir, writeFile } from "node:fs/promises";

const AGENDA_URL =
  "https://aws.amazon.com/api/dirs/items/search?item.directoryId=events-cards-interactive-summits-sydney-agenda&item.locale=en_US&size=200";

function stripHtml(input) {
  return input
    .replace(/<li>/g, "\n- ")
    .replace(/<\/li>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractListItems(input) {
  return [...input.matchAll(/<li>(.*?)<\/li>/g)].map((match) =>
    stripHtml(match[1]).trim(),
  );
}

function parseSessionTime(body) {
  // Parse "WPS302 | 14-May | 15:00 - 15:30" format
  const timeMatch = body?.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (timeMatch) {
    const startTime = `${timeMatch[1]}:${timeMatch[2]}`;
    const endTime = `${timeMatch[3]}:${timeMatch[4]}`;
    return { startTime, endTime };
  }
  return { startTime: null, endTime: null };
}

function normalizeSession(entry, index) {
  const fields = entry.item.additionalFields;
  const speakers = extractListItems(fields.bodyBack ?? "");
  const description = stripHtml(fields.bodyBack ?? "");
  const companies = (fields.namePerson ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const { startTime, endTime } = parseSessionTime(fields.body);

  return {
    id: entry.item.id,
    code: entry.item.name,
    title: fields.title,
    sessionType: fields.heading,
    level: fields.level ?? "unspecified",
    language: fields.language ?? "English",
    organisations: companies,
    speakers,
    description,
    registerUrl: fields.ctaLink,
    startTime,
    endTime,
    tags: entry.tags.map((tag) => ({
      namespace: tag.tagNamespaceId,
      label: tag.name,
      description: tag.description,
    })),
    plannerDay: index % 2 === 0 ? "day1" : "day2",
  };
}

async function main() {
  const response = await fetch(AGENDA_URL, {
    headers: {
      "user-agent": "conferenceapp/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Agenda fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  const sessions = payload.items.map(normalizeSession);

  const data = {
    source: {
      agendaUrl: "https://aws.amazon.com/events/summits/sydney/agenda/",
      apiUrl: AGENDA_URL,
      fetchedAt: new Date().toISOString(),
      totalSessions: payload.metadata.totalHits,
      note:
        "AWS exposes catalogue metadata publicly, but not explicit day/time slots in this feed. The app keeps a two-day planner and seeds each talk into Day 1 or Day 2 as a starting draft you can change.",
    },
    event: {
      name: "AWS Summit Sydney",
      venue: "International Convention Centre (ICC) Sydney",
      dates: ["2026-05-13", "2026-05-14"],
    },
    sessions,
  };

  await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../src/data/sessions.json", import.meta.url),
    JSON.stringify(data, null, 2),
  );

  console.log(`Wrote ${sessions.length} sessions to src/data/sessions.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
