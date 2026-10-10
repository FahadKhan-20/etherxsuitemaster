import { describe, it, expect } from 'vitest';
import { scheduleStart, tomorrowInTimezone, validateSchedule } from '../src/utils/scheduleValidation';

const form = (updates = {}) => ({ title: 'Planning', date: '2027-01-10', time: '10:00', duration: '45', recurring: 'none', participants: '', ...updates });
const now = Date.parse('2027-01-01T00:00:00Z');

describe('account timezone scheduling', () => {
  it('converts account wall time without depending on the browser timezone', () => {
    expect(validateSchedule(form(), 'Asia/Kolkata', now).input.startAt).toBe('2027-01-10T04:30:00.000Z');
    expect(validateSchedule(form(), 'America/New_York', now).input.startAt).toBe('2027-01-10T15:00:00.000Z');
  });
  it('uses the next calendar day in the account timezone around midnight', () => {
    expect(tomorrowInTimezone('Asia/Kolkata', Date.parse('2027-01-01T21:00:00Z'))).toBe('2027-01-03');
    expect(tomorrowInTimezone('America/Los_Angeles', Date.parse('2027-01-01T01:00:00Z'))).toBe('2027-01-01');
  });
  it('rejects nonexistent dates and times skipped by daylight saving', () => {
    expect(scheduleStart('2027-02-30', '10:00', 'UTC')).toEqual([]);
    expect(validateSchedule(form({ date: '2027-03-14', time: '02:30' }), 'America/New_York', now).errors.time).toContain('valid date and time');
  });
  it('does not silently choose an offset for a repeated daylight-saving hour', () => {
    expect(scheduleStart('2027-11-07', '01:30', 'America/New_York')).toHaveLength(2);
    expect(validateSchedule(form({ date: '2027-11-07', time: '01:30' }), 'America/New_York', now).errors.time).toContain('occurs twice');
  });
  it('handles a timezone with a 30-minute daylight-saving transition', () => {
    expect(scheduleStart('2027-10-03', '02:15', 'Australia/Lord_Howe')).toEqual([]);
    expect(scheduleStart('2027-04-04', '01:45', 'Australia/Lord_Howe')).toHaveLength(2);
  });
  it('rejects a past start even if its recurrence is enabled', () => {
    expect(validateSchedule(form({ date: '2026-12-31', recurring: 'weekly' }), 'UTC', now).errors.time).toContain('future');
  });
});

describe('schedule input validation', () => {
  it('keeps valid invitees, normalizes case and removes duplicates', () => {
    const result = validateSchedule(form({ participants: ' Alice@example.com,alice@example.com,BOB@example.com ' }), 'UTC', now);
    expect(result.errors).toEqual({});
    expect(result.input.participants).toEqual(['alice@example.com', 'bob@example.com']);
  });
  it('does not silently discard an invalid or empty email entry', () => {
    for (const participants of ['alice@example.com,bad', 'alice@example.com,', 'a@b', 'a b@example.com']) {
      const result = validateSchedule(form({ participants }), 'UTC', now);
      expect(result.errors.participants).toBeTruthy();
      expect(result.input).toBeNull();
    }
  });
  it('rejects invalid durations and missing required input', () => {
    for (const duration of ['', '4', '481', '5.5']) expect(validateSchedule(form({ duration }), 'UTC', now).input).toBeNull();
    expect(validateSchedule(form({ title: ' ', date: '', time: '' }), 'UTC', now).errors).toMatchObject({ title: expect.any(String), date: expect.any(String), time: expect.any(String) });
  });
});
