const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

/**
 * Google Calendar "create event" link with the meeting filled in: title, time, repeat, invited
 * emails and the room link. Opening it needs no Google setup; the user confirms the event in Google.
 */
export function googleCalendarUrl(meeting, origin = window.location.origin) {
  const start = new Date(meeting.date);
  const end = new Date(start.getTime() + meeting.duration * 60000);
  const room = `${origin}/room/${meeting.roomCode}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: meeting.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `Join the EtherX Meet room: ${room}`,
    location: room,
  });
  if (meeting.recurring && meeting.recurring !== 'none') params.set('recur', `RRULE:FREQ=${meeting.recurring.toUpperCase()}`);
  if (meeting.participants?.length) params.set('add', meeting.participants.join(','));
  return `https://calendar.google.com/calendar/render?${params}`;
}
