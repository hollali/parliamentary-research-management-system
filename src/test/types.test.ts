import { describe, it, expect } from 'vitest';
import type { ResearchRequest, NotificationItem } from '../types';

describe('ResearchRequest status types', () => {
  const validStatuses: ResearchRequest['status'][] = [
    'SUBMITTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'DRAFT_SUBMITTED',
    'REVISION_REQUESTED',
    'REVISED',
    'APPROVED',
    'DELIVERED',
    'CLOSED',
    'OVERDUE',
  ];

  it('contains all valid status values', () => {
    expect(validStatuses).toHaveLength(10);
    expect(validStatuses).toContain('SUBMITTED');
    expect(validStatuses).toContain('ASSIGNED');
    expect(validStatuses).toContain('IN_PROGRESS');
    expect(validStatuses).toContain('DRAFT_SUBMITTED');
    expect(validStatuses).toContain('REVISION_REQUESTED');
    expect(validStatuses).toContain('REVISED');
    expect(validStatuses).toContain('APPROVED');
    expect(validStatuses).toContain('DELIVERED');
    expect(validStatuses).toContain('CLOSED');
    expect(validStatuses).toContain('OVERDUE');
  });

  it('rejects invalid status values at type level', () => {
    const statusMap: Record<ResearchRequest['status'], string> = {
      SUBMITTED: 'Submitted',
      ASSIGNED: 'Assigned',
      IN_PROGRESS: 'In Progress',
      DRAFT_SUBMITTED: 'Draft Submitted',
      REVISION_REQUESTED: 'Revision Requested',
      REVISED: 'Revised',
      APPROVED: 'Approved',
      DELIVERED: 'Delivered',
      CLOSED: 'Closed',
      OVERDUE: 'Overdue',
    };

    for (const status of validStatuses) {
      expect(statusMap[status]).toBeDefined();
      expect(typeof statusMap[status]).toBe('string');
    }
  });
});

describe('NotificationItem type types', () => {
  const validNotificationTypes: NotificationItem['type'][] = [
    'CRITICAL',
    'RESEARCH',
    'COLLABORATION',
    'WARNING',
  ];

  it('contains all valid notification type values', () => {
    expect(validNotificationTypes).toHaveLength(4);
    expect(validNotificationTypes).toContain('CRITICAL');
    expect(validNotificationTypes).toContain('RESEARCH');
    expect(validNotificationTypes).toContain('COLLABORATION');
    expect(validNotificationTypes).toContain('WARNING');
  });
});
