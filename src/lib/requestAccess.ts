import type { ResearchRequest, User } from '../types';

export function filterRequestsForCurrentUser(requests: ResearchRequest[], currentUser: User): ResearchRequest[] {
    if (!currentUser?.id) {
        return [];
    }

    if (currentUser.role !== 'MP') {
        return requests;
    }

    return requests.filter((request) => {
        const submitterId = (request as ResearchRequest & { submitterId?: string }).submitterId;
        return submitterId ? submitterId === currentUser.id : request.member === currentUser.name;
    });
}
