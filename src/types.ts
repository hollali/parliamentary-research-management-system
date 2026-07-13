export type Role = 'ADMIN' | 'RESEARCH_OFFICER' | 'MP';

export interface Committee {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  committeeType: 'STANDING' | 'SELECT' | 'JOINT' | 'AD_HOC';
  chairperson: string | null;
  clerk: string | null;
  jurisdiction: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  avatarUrl?: string;
  initials: string;
  title: string;
}

export interface Attachment {
  id?: string;
  name: string;
  type: 'pdf' | 'xlsx' | 'docx';
  size: string;
  url?: string;
}

export interface Comment {
  id: string;
  userName: string;
  userInitials: string;
  role: string;
  time: string;
  text: string;
  section?: string;
  highlightedText?: string;
  resolved?: boolean;
}

export interface HistoryItem {
  id: string;
  userName: string;
  text: string;
  time: string;
  sector?: string;
  type: 'alert' | 'update' | 'normal';
}

export interface ResearchRequest {
  id: string;
  title: string;
  topic: string;
  category: string;
  committeeId?: string | null;
  committeeName?: string | null;
  reportId?: string | null;
  member: string; // Member who requested
  assignedOfficerId: string | null; // ID of Officer
  assignedOfficerName: string | null;
  teamId?: string | null;
  teamName?: string | null;
  assignedOfficers?: { id: string; firstName: string; lastName: string; initials: string }[];
  status: 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DRAFT_SUBMITTED' | 'REVISION_REQUESTED' | 'REVISED' | 'APPROVED' | 'DELIVERED' | 'CLOSED' | 'OVERDUE';
  priority: 'STANDARD' | 'URGENT';
  dateSubmitted: string;
  deadline: string;
  description: string;
  scope?: string;
  language: string;
  draftVersion: number;
  attachments: Attachment[];
  comments: Comment[];
  content: string; // The text content of the report draft (if active)
  keyStakeholders?: string;
  dataSources?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'CRITICAL' | 'RESEARCH' | 'COLLABORATION' | 'WARNING';
  read: boolean;
  link?: string;
}

export interface AppState {
  currentUser: User;
  requests: ResearchRequest[];
  notifications: NotificationItem[];
  history: HistoryItem[];
  preferences: {
    pushNotifications: boolean;
    emailSummaries: boolean;
    triggers: {
      newAssignments: boolean;
      statusChanges: boolean;
      draftMentions: boolean;
      deadlineReminders: boolean;
    };
  };
}
