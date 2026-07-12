import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, ResearchRequest, NotificationItem, HistoryItem, AppState, Comment, Attachment, Role } from '../types';
import { loginApi, getRequests, getNotifications, checkHealth, getToken, clearToken, createReview, resolveReviewComment, requestRevision, approveReport, createReport, getUsers, createAssignment, updateRequest, markAllNotificationsRead as apiMarkAllRead, updateUserProfile, getActivityLog } from '../lib/api';

interface AppContextType extends AppState {
  login: (email: string, password?: string) => Promise<boolean> | boolean;
  logout: () => void;
  switchUser: (role: Role) => Promise<void> | void;
  isOnline: boolean;
  addRequest: (request: Omit<ResearchRequest, 'id' | 'dateSubmitted' | 'draftVersion' | 'comments' | 'content'>) => Promise<void> | void;
  assignRequest: (requestId: string, officerIds?: string[], teamId?: string, deadline?: string, notes?: string) => Promise<void> | void;
  updateRequestStatus: (requestId: string, status: ResearchRequest['status']) => void;
  updateRequestPriority: (requestId: string, priority: ResearchRequest['priority']) => void;
  extendRequestDeadline: (requestId: string, newDeadline: string) => void;
  addComment: (requestId: string, text: string, section?: string) => void;
  resolveComment: (requestId: string, commentId: string) => void;
  updateRequestContent: (requestId: string, content: string) => void;
  uploadAttachment: (requestId: string, attachment: Attachment) => void;
  deleteAttachment: (requestId: string, name: string) => void;
  markAllNotificationsRead: () => void;
  savePreferences: (push: boolean, email: boolean, triggers: AppState['preferences']['triggers']) => void;
  updateProfile: (updates: { firstName?: string; lastName?: string; title?: string; phone?: string; constituency?: string }) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapApiRequest(r: any): ResearchRequest {
  const statusMap: Record<string, ResearchRequest['status']> = {
    SUBMITTED: 'PENDING_REVIEW',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    DRAFT_SUBMITTED: 'IN_PROGRESS',
    REVISION_REQUESTED: 'REVISION_REQUESTED',
    REVISED: 'REVISION_IN_PROGRESS',
    APPROVED: 'COMPLETED',
    DELIVERED: 'COMPLETED',
    CLOSED: 'COMPLETED',
  };

  return {
    id: r.requestNumber || r.id,
    title: r.title,
    topic: r.subject || r.title,
    category: r.category?.name || '',
    member: r.submitter ? `${r.submitter.firstName} ${r.submitter.lastName}` : '',
    assignedOfficerId: r.assignedOfficerId || null,
    assignedOfficerName: r.officer ? `${r.officer.firstName} ${r.officer.lastName}` : null,
    status: statusMap[r.status] || 'PENDING_REVIEW',
    priority: r.priority as ResearchRequest['priority'],
    dateSubmitted: new Date(r.dateSubmitted).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    deadline: new Date(r.deadline).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    description: r.description,
    scope: r.scope || undefined,
    language: r.language || 'English',
    draftVersion: r.draftVersion || 1,
    attachments: (r.attachments || []).map((a: any) => ({
      name: a.name,
      type: a.fileType?.toLowerCase() || 'pdf',
      size: a.fileSize ? `${(a.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
      url: a.filePath,
    })),
    comments: (r.comments || []).map((c: any) => ({
      id: c.id,
      userName: c.author ? `${c.author.firstName} ${c.author.lastName}` : 'Unknown',
      userInitials: c.author?.initials || '??',
      role: c.author?.role || 'Unknown',
      time: new Date(c.createdAt).toLocaleString(),
      text: c.text,
      section: c.section || undefined,
      resolved: c.resolved,
    })),
    reportId: r.reports?.[0]?.id || null,
    content: r.reports?.[0]?.content || '',
    keyStakeholders: r.keyStakeholders || undefined,
    dataSources: r.dataSources || undefined,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUser = localStorage.getItem('prrms_user');
    return savedUser ? JSON.parse(savedUser) : { id: '', name: '', role: 'MP' as Role, email: '', initials: '', title: '' };
  });

  const [requests, setRequests] = useState<ResearchRequest[]>([]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('prrms_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [preferences, setPreferences] = useState<AppState['preferences']>(() => {
    const savedPrefs = localStorage.getItem('prrms_prefs');
    return savedPrefs ? JSON.parse(savedPrefs) : {
      pushNotifications: true,
      emailSummaries: false,
      triggers: {
        newAssignments: true,
        statusChanges: true,
        draftMentions: false,
        deadlineReminders: true
      }
    };
  });

  const [isOnline, setIsOnline] = useState(false);

  // Check backend availability on mount
  useEffect(() => {
    checkHealth().then(setIsOnline);
  }, []);

  // Fetch data from API if online and token exists
  useEffect(() => {
    if (!isOnline || !getToken()) return;

    getRequests().then((data: any) => {
      if (data?.requests) {
        const mapped = data.requests.map(mapApiRequest);
        setRequests(mapped);
      }
    }).catch(() => {});

    getNotifications().then((data: any) => {
      if (data?.notifications) {
        const typeMap: Record<string, NotificationItem['type']> = {
          REQUEST_SUBMITTED: 'RESEARCH',
          REQUEST_ASSIGNED: 'COLLABORATION',
          REPORT_UPLOADED: 'RESEARCH',
          REVISION_REQUESTED: 'WARNING',
          REPORT_APPROVED: 'CRITICAL',
          REPORT_DELIVERED: 'CRITICAL',
          GENERAL: 'RESEARCH',
        };
        const mapped = data.notifications.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          time: new Date(n.createdAt).toLocaleString(),
          type: typeMap[n.type] || 'RESEARCH',
          read: n.isRead,
          link: n.link,
        }));
        setNotifications(mapped);
      }
    }).catch(() => {});

    getActivityLog({ limit: 20 }).then((data: any) => {
      const logs = data?.activity || [];
      const mapped: HistoryItem[] = logs.map((a: any) => ({
        id: a.id,
        userName: a.author ? `${a.author.firstName} ${a.author.lastName}` : 'System',
        text: a.description || `${a.action} ${a.entityType}`,
        time: new Date(a.createdAt).toLocaleString(),
        sector: a.entityType,
        type: (a.action === 'DELETE' ? 'alert' : a.action === 'UPDATE' ? 'update' : 'normal') as HistoryItem['type'],
      }));
      setHistory(mapped);
    }).catch(() => {});
  }, [isOnline]);

  useEffect(() => {
    localStorage.setItem('prrms_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('prrms_requests', JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem('prrms_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('prrms_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('prrms_prefs', JSON.stringify(preferences));
  }, [preferences]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (!isOnline) return false;
    if (!password) return false;

    try {
      const data = await loginApi(email, password);
      const apiUser: User = {
        id: data.user.id,
        name: `${data.user.firstName} ${data.user.lastName}`,
        role: data.user.role as Role,
        email: data.user.email,
        initials: data.user.initials,
        title: data.user.title || data.user.role,
      };
      setCurrentUser(apiUser);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('prrms_user');
    setCurrentUser({ id: '', name: '', role: 'MP' as Role, email: '', initials: '', title: '' });
  };

  const switchUser = async (role: Role) => {
    // Fetch real user from API by role
    if (isOnline) {
      try {
        const data = await getUsers({ role });
        if (data && Array.isArray(data) && data.length > 0) {
          const u = data[0];
          setCurrentUser({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            role: u.role as Role,
            email: u.email,
            initials: u.initials,
            title: u.title || u.role,
          });
          return;
        }
      } catch {
        // Fall through
      }
    }
  };

  const addRequest = async (newReqData: Omit<ResearchRequest, 'id' | 'dateSubmitted' | 'draftVersion' | 'comments' | 'content'>) => {
    // Persist to backend if online
    if (isOnline) {
      try {
        const { createRequest } = await import('../lib/api');
        await createRequest({
          title: newReqData.title,
          subject: newReqData.topic,
          description: newReqData.description || '',
          scope: newReqData.scope,
          keyStakeholders: newReqData.keyStakeholders,
          dataSources: newReqData.dataSources,
          language: newReqData.language,
          priority: newReqData.priority,
          deadline: newReqData.deadline,
        });
        // Refresh requests from API
        const data = await getRequests();
        if (data?.requests) {
          setRequests(data.requests.map(mapApiRequest));
        }
        return;
      } catch {
        // Fall through to local-only
      }
    }
  };

  const assignRequest = async (requestId: string, officerIds?: string[], teamId?: string, deadline?: string, notes?: string) => {
    if (isOnline) {
      try {
        const fullReq = await (await import('../lib/api')).getRequest(requestId);
        const internalId = fullReq?.id || requestId;
        const resolvedDeadline = deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await createAssignment({
          requestId: internalId,
          assignedToIds: officerIds?.length ? officerIds : undefined,
          teamId,
          deadline: resolvedDeadline,
          notes,
        });
        const data = await getRequests();
        if (data?.requests) {
          setRequests(data.requests.map(mapApiRequest));
        }
      } catch (err: any) {
        throw err;
      }
    }
  };

  const updateRequestStatus = async (requestId: string, status: ResearchRequest['status']) => {
    // Map frontend status back to backend status
    const reverseStatusMap: Record<string, string> = {
      PENDING_REVIEW: 'SUBMITTED',
      ASSIGNED: 'ASSIGNED',
      IN_PROGRESS: 'IN_PROGRESS',
      REVISION_REQUESTED: 'REVISION_REQUESTED',
      REVISION_IN_PROGRESS: 'REVISED',
      COMPLETED: 'APPROVED',
    };

    // Persist to backend if online
    let apiFailed = false;
    if (isOnline) {
      const req = requests.find(r => r.id === requestId);
      try {
        if (status === 'REVISION_REQUESTED' && req?.reportId) {
          await requestRevision({ reportId: req.reportId, requestId });
        } else if (status === 'COMPLETED' && req?.reportId) {
          await approveReport({ reportId: req.reportId, requestId });
        } else {
          const backendStatus = reverseStatusMap[status] || status;
          await updateRequest(requestId, { status: backendStatus });
        }
      } catch {
        apiFailed = true;
      }
    }

    if (!apiFailed) {
      setRequests(prev => prev.map(req => {
        if (req.id === requestId) {
          return { ...req, status };
        }
        return req;
      }));

      // Notify relevant parties
      const reqTitle = requests.find(r => r.id === requestId)?.title || 'Request';
      const newNotif: NotificationItem = {
        id: 'notif_' + Date.now(),
        title: `Status Update: ${requestId}`,
        message: `"${reqTitle}" status changed to ${status.replace('_', ' ')}`,
        time: 'Just now',
        type: 'RESEARCH',
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const updateRequestPriority = async (requestId: string, priority: ResearchRequest['priority']) => {
    if (isOnline) {
      try {
        await updateRequest(requestId, { priority });
      } catch (err) {
        console.error('Failed to update priority:', err);
        return;
      }
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, priority };
      }
      return req;
    }));

    const newNotif: NotificationItem = {
      id: 'notif_' + Date.now(),
      title: `Priority Updated: ${requestId}`,
      message: `Priority set to ${priority}`,
      time: 'Just now',
      type: 'RESEARCH',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const extendRequestDeadline = async (requestId: string, newDeadline: string) => {
    if (isOnline) {
      try {
        await updateRequest(requestId, { deadline: newDeadline });
      } catch (err) {
        console.error('Failed to extend deadline:', err);
        return;
      }
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, deadline: newDeadline };
      }
      return req;
    }));

    const newNotif: NotificationItem = {
      id: 'notif_' + Date.now(),
      title: `Deadline Extended: ${requestId}`,
      message: `Deadline extended to ${newDeadline}`,
      time: 'Just now',
      type: 'RESEARCH',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const addComment = async (requestId: string, text: string, section?: string) => {
    const newComment: Comment = {
      id: 'comment_' + Date.now(),
      userName: currentUser.name + (currentUser.role === 'ADMIN' ? ' (Admin)' : ''),
      userInitials: currentUser.initials,
      role: currentUser.role === 'ADMIN' ? 'Admin' : currentUser.role === 'RESEARCH_OFFICER' ? 'Researcher' : 'Member',
      time: 'Just now',
      text,
      section,
      resolved: false
    };

    // Persist to backend if online
    if (isOnline) {
      const req = requests.find(r => r.id === requestId);
      if (req?.reportId) {
        try {
          const created = await createReview({
            reportId: req.reportId,
            requestId,
            section: section || '',
            text,
          });
          newComment.id = created.id || newComment.id;
        } catch {
          // Fall through to local-only
        }
      }
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          comments: [...req.comments, newComment]
        };
      }
      return req;
    }));

    // Trigger notification
    const req = requests.find(r => r.id === requestId);
    if (req) {
      const newNotif: NotificationItem = {
        id: 'notif_' + Date.now(),
        title: 'New Collaboration Comment',
        message: `${currentUser.name} commented on ${requestId}: "${text.slice(0, 40)}..."`,
        time: 'Just now',
        type: 'COLLABORATION',
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const resolveComment = async (requestId: string, commentId: string) => {
    // Persist to backend if online
    if (isOnline) {
      try {
        await resolveReviewComment(commentId);
      } catch {
        // Fall through to local-only
      }
    }

    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          comments: req.comments.map(c => c.id === commentId ? { ...c, resolved: true } : c)
        };
      }
      return req;
    }));
  };

  const updateRequestContent = (requestId: string, content: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return { ...req, content };
      }
      return req;
    }));
  };

  const uploadAttachment = (requestId: string, attachment: Attachment) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          attachments: [...req.attachments, attachment]
        };
      }
      return req;
    }));
  };

  const deleteAttachment = (requestId: string, name: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          attachments: req.attachments.filter(a => a.name !== name)
        };
      }
      return req;
    }));
  };

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (isOnline) {
      try {
        await apiMarkAllRead();
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    }
  };

  const savePreferences = (push: boolean, email: boolean, triggers: AppState['preferences']['triggers']) => {
    setPreferences({
      pushNotifications: push,
      emailSummaries: email,
      triggers
    });
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      requests,
      notifications,
      history,
      preferences,
      isOnline,
      login,
      logout,
      switchUser,
      addRequest,
      assignRequest,
      updateRequestStatus,
      updateRequestPriority,
      extendRequestDeadline,
      addComment,
      resolveComment,
      updateRequestContent,
      uploadAttachment,
      deleteAttachment,
      markAllNotificationsRead,
      savePreferences,
      updateProfile: async (updates) => {
        const data = await updateUserProfile(updates);
        if (data) {
          setCurrentUser((prev) => ({
            ...prev,
            name: `${data.firstName} ${data.lastName}`,
            initials: data.initials || prev.initials,
            title: data.title || prev.title,
            email: data.email || prev.email,
          }));
        }
      }
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
