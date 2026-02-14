import { google, calendar_v3 } from "googleapis";

export function getCalendarClient(
  accessToken: string,
  refreshToken: string
): calendar_v3.Calendar {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function createCalendarEvent(
  client: calendar_v3.Calendar,
  thought: { summary: string; deadline: string; description?: string }
): Promise<string> {
  const startDate = new Date(thought.deadline);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour

  const res = await client.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: thought.summary,
      description: thought.description || "",
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    },
  });

  return res.data.id!;
}

export async function updateCalendarEvent(
  client: calendar_v3.Calendar,
  eventId: string,
  updates: { summary?: string; deadline?: string; description?: string }
): Promise<void> {
  const requestBody: calendar_v3.Schema$Event = {};
  if (updates.summary) requestBody.summary = updates.summary;
  if (updates.description) requestBody.description = updates.description;
  if (updates.deadline) {
    const startDate = new Date(updates.deadline);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    requestBody.start = { dateTime: startDate.toISOString() };
    requestBody.end = { dateTime: endDate.toISOString() };
  }

  await client.events.patch({
    calendarId: "primary",
    eventId,
    requestBody,
  });
}

export async function deleteCalendarEvent(
  client: calendar_v3.Calendar,
  eventId: string
): Promise<void> {
  await client.events.delete({
    calendarId: "primary",
    eventId,
  });
}
