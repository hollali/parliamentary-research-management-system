import { describe, it, expect } from 'vitest';
import { filterRequestsForCurrentUser } from '../lib/requestAccess';
import type { ResearchRequest } from '../types';

describe('filterRequestsForCurrentUser', () => {
    it('matches an MP request by submitter id when the displayed name differs', () => {
        const requests: ResearchRequest[] = [
            {
                id: 'REQ-100',
                title: 'Climate policy review',
                topic: 'Climate policy',
                category: 'Environment',
                member: 'Hon. Jane Doe',
                submitterId: 'user-1',
                assignedOfficerId: null,
                assignedOfficerName: 'R. Smith',
                status: 'IN_PROGRESS',
                priority: 'STANDARD',
                dateSubmitted: '2026-07-01',
                deadline: '2026-07-30',
                description: 'Needs review',
                language: 'English',
                draftVersion: 1,
                attachments: [],
                comments: [],
                content: '',
            },
        ];

        const currentUser = {
            id: 'user-1',
            name: 'Jane Doe',
            role: 'MP' as const,
            email: 'jane@example.com',
            initials: 'JD',
            title: 'Hon.',
        };

        expect(filterRequestsForCurrentUser(requests, currentUser)).toHaveLength(1);
        expect(filterRequestsForCurrentUser(requests, currentUser)[0].id).toBe('REQ-100');
    });
});
