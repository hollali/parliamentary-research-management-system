import { describe, it, expect } from 'vitest';
import { formatRequestStatus, REQUEST_STATUS_LABELS } from '../lib/status';

describe('member confirmation closes the brief', () => {
  it('labels the status a confirmed brief ends up in as Closed', () => {
    expect(formatRequestStatus('CLOSED')).toBe('Closed');
  });

  it('never labels a confirmed brief as "Confirmed"', () => {
    // The sign-off is recorded on the request (memberConfirmedAt), not in the
    // status. Anything the MP confirms now reads Closed everywhere.
    expect(formatRequestStatus('CLOSED')).not.toMatch(/confirm/i);
  });

  it('still renders legacy MEMBER_CONFIRMED rows without crashing', () => {
    // Rows written before the change still carry this status.
    expect(formatRequestStatus('MEMBER_CONFIRMED')).toBe('Confirmed by Member');
    expect(REQUEST_STATUS_LABELS.CLOSED).toBe('Closed');
  });

  it('falls back to a readable label for an unknown status', () => {
    expect(formatRequestStatus('SOMETHING_NEW')).toBe('SOMETHING NEW');
    expect(formatRequestStatus(null)).toBe('');
  });
});
