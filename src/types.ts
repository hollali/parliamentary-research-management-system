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
  constituency?: string;
  phone?: string;
}

export interface Attachment {
  id?: string;
  name: string;
  type: 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'txt' | 'csv' | 'rtf' | 'odt' | 'zip';
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
  submitterId?: string | null; // Authenticated submitter id for role-based filtering
  assignedOfficerId: string | null; // ID of Officer
  assignedOfficerName: string | null;
  teamId?: string | null;
  teamName?: string | null;
  assignedOfficers?: { id: string; firstName: string; lastName: string; initials: string }[];
  declinedAssignments?: { id: string; firstName: string; lastName: string; initials: string; reason: string | null }[];
  previousOfficers?: { id: string; firstName: string; lastName: string; initials: string; reason: string | null }[];
  status: 'SUBMITTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DRAFT_SUBMITTED' | 'REVISION_REQUESTED' | 'REVISED' | 'APPROVED' | 'DELIVERED' | 'CLOSED' | 'OVERDUE';
  priority: 'STANDARD' | 'URGENT';
  dateSubmitted: string;
  dateSubmittedRaw?: string | null;
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
  templateId?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'CRITICAL' | 'RESEARCH' | 'COLLABORATION' | 'WARNING';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sections: { heading: string; prompt: string }[];
  isBuiltIn: boolean;
  createdById: string | null;
  createdAt: string;
}

export interface AppState {
  currentUser: User;
  requests: ResearchRequest[];
  notifications: NotificationItem[];
  history: HistoryItem[];
  templates: TemplateItem[];
  preferences: {
    pushNotifications: boolean;
    emailSummaries: boolean;
    emailNotifications: boolean;
    whatsappNotifications: boolean;
    triggers: {
      newAssignments: boolean;
      statusChanges: boolean;
      draftMentions: boolean;
      deadlineReminders: boolean;
    };
  };
}
