import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLastBackupDate, recordBackup, backupAgeLabel, backupAgeStatus } from './backupStatus';

describe('backupStatus', () => {
  const KEY = 'rm-last-backup';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-15T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getLastBackupDate', () => {
    it('returns null if no backup exists', () => {
      expect(getLastBackupDate()).toBeNull();
    });

    it('returns a Date object if backup exists', () => {
      localStorage.setItem(KEY, '2024-05-10T12:00:00.000Z');
      const date = getLastBackupDate();
      expect(date).toBeInstanceOf(Date);
      expect(date?.toISOString()).toBe('2024-05-10T12:00:00.000Z');
    });

    it('returns null if localStorage throws an error', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });
      expect(getLastBackupDate()).toBeNull();
    });
  });

  describe('recordBackup', () => {
    it('saves the current time to localStorage', () => {
      recordBackup();
      expect(localStorage.getItem(KEY)).toBe('2024-05-15T12:00:00.000Z');
    });

    it('does not throw if localStorage throws an error', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });
      expect(() => recordBackup()).not.toThrow();
    });
  });

  describe('backupAgeLabel', () => {
    it('returns "Heute" for 0 days', () => {
      expect(backupAgeLabel(new Date('2024-05-15T10:00:00.000Z'))).toBe('Heute');
    });

    it('returns "Gestern" for 1 day', () => {
      expect(backupAgeLabel(new Date('2024-05-14T10:00:00.000Z'))).toBe('Gestern');
    });

    it('returns "vor X Tagen" for 2-6 days', () => {
      expect(backupAgeLabel(new Date('2024-05-12T10:00:00.000Z'))).toBe('vor 3 Tagen');
      expect(backupAgeLabel(new Date('2024-05-09T10:00:00.000Z'))).toBe('vor 6 Tagen');
    });

    it('returns "vor 1 Woche" for 7-13 days', () => {
      expect(backupAgeLabel(new Date('2024-05-08T10:00:00.000Z'))).toBe('vor 1 Woche');
      expect(backupAgeLabel(new Date('2024-05-02T10:00:00.000Z'))).toBe('vor 1 Woche');
    });

    it('returns "vor X Wochen" for 14-29 days', () => {
      expect(backupAgeLabel(new Date('2024-05-01T10:00:00.000Z'))).toBe('vor 2 Wochen');
      expect(backupAgeLabel(new Date('2024-04-20T10:00:00.000Z'))).toBe('vor 3 Wochen');
      expect(backupAgeLabel(new Date('2024-04-17T10:00:00.000Z'))).toBe('vor 4 Wochen'); // 28 days
    });

    it('returns "vor 1 Monat" for 30-59 days', () => {
      expect(backupAgeLabel(new Date('2024-04-15T10:00:00.000Z'))).toBe('vor 1 Monat'); // 30 days
      expect(backupAgeLabel(new Date('2024-03-20T10:00:00.000Z'))).toBe('vor 1 Monat'); // 56 days
    });

    it('returns "vor X Monaten" for 60+ days', () => {
      expect(backupAgeLabel(new Date('2024-03-15T10:00:00.000Z'))).toBe('vor 2 Monaten'); // 61 days
      expect(backupAgeLabel(new Date('2023-05-15T10:00:00.000Z'))).toBe('vor 12 Monaten'); // 366 days
    });
  });

  describe('backupAgeStatus', () => {
    it('returns "none" for null', () => {
      expect(backupAgeStatus(null)).toBe('none');
    });

    it('returns "fresh" for < 7 days', () => {
      expect(backupAgeStatus(new Date('2024-05-15T10:00:00.000Z'))).toBe('fresh'); // 0 days
      expect(backupAgeStatus(new Date('2024-05-09T10:00:00.000Z'))).toBe('fresh'); // 6 days
    });

    it('returns "stale" for 7-29 days', () => {
      expect(backupAgeStatus(new Date('2024-05-08T10:00:00.000Z'))).toBe('stale'); // 7 days
      expect(backupAgeStatus(new Date('2024-04-17T10:00:00.000Z'))).toBe('stale'); // 28 days
    });

    it('returns "old" for 30+ days', () => {
      expect(backupAgeStatus(new Date('2024-04-15T10:00:00.000Z'))).toBe('old'); // 30 days
      expect(backupAgeStatus(new Date('2024-03-15T10:00:00.000Z'))).toBe('old'); // 61 days
    });
  });
});
