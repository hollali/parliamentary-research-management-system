import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  User,
  ResearchRequest,
  NotificationItem,
  HistoryItem,
  TemplateItem,
  AppState,
  Comment,
  Attachment,
  Role,
} from "../types";
import {
  loginApi,
  logoutApi,
  getRequests,
  getNotifications,
  checkHealth,
  getToken,
  clearToken,
  createReview,
  resolveReviewComment,
  requestRevision,
  approveReport,
  createReport,
  getUsers,
  createAssignment,
  updateRequest,
  markAllNotificationsRead as apiMarkAllRead,
  markNotificationRead as apiMarkNotificationRead,
  updateUserProfile,
  getActivityLog,
  getNotificationPrefs,
  updateNotificationPrefs,
  createRequest,
  getRequest,
  impersonateUser,
  getTemplates,
  createTemplate as apiCreateTemplate,
  updateTemplate as apiUpdateTemplate,
  deleteTemplate as apiDeleteTemplate,
} from "../lib/api";

interface AppContextType extends AppState {
  login: (email: string, password?: string) => Promise<boolean> | boolean;
  logout: () => void;
  switchUser: (role: Role) => Promise<void> | void;
  isOnline: boolean;
  addRequest: (
    request: Omit<
      ResearchRequest,
      "id" | "dateSubmitted" | "draftVersion" | "comments" | "content"
    >,
  ) => Promise<boolean>;
  assignRequest: (
    requestId: string,
    officerIds?: string[],
    teamId?: string,
    deadline?: string,
    notes?: string,
    action?: "assign" | "reassign" | "add",
  ) => Promise<void> | void;
  refreshRequests: () => Promise<void>;
  requestRevisionForRequest: (requestId: string, commentText?: string) => Promise<void>;
  approveRequestForReview: (requestId: string) => Promise<void>;
  updateRequestStatus: (
    requestId: string,
    status: ResearchRequest["status"],
  ) => void;
  updateRequestPriority: (
    requestId: string,
    priority: ResearchRequest["priority"],
  ) => void;
  extendRequestDeadline: (requestId: string, newDeadline: string) => Promise<boolean>;
  addComment: (
    requestId: string,
    text: string,
    section?: string,
    highlightedText?: string,
    startOffset?: number,
    endOffset?: number,
    parentId?: string,
  ) => void;
  resolveComment: (requestId: string, commentId: string) => void;
  updateRequestContent: (requestId: string, content: string) => void;
  uploadAttachment: (requestId: string, attachment: Attachment) => void;
  deleteAttachment: (requestId: string, name: string) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  savePreferences: (
    push: boolean,
    email: boolean,
    emailRealTime: boolean,
    whatsapp: boolean,
    triggers: AppState["preferences"]["triggers"],
  ) => void;
  addTemplate: (
    name: string,
    description: string | undefined,
    category: string,
    sections: { heading: string; prompt: string }[],
  ) => Promise<any>;
  updateTemplate: (
    id: string,
    name: string,
    description: string | undefined,
    category: string,
    sections: { heading: string; prompt: string }[],
  ) => Promise<any>;
  removeTemplate: (id: string) => Promise<void>;
  updateProfile: (updates: {
    firstName?: string;
    lastName?: string;
    title?: string;
    phone?: string;
    constituency?: string;
  }) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function formatDisplayDate(value: unknown): string {
  if (!value) return "Not set";

  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function mapApiRequest(r: any): ResearchRequest {
  const statusMap: Record<string, ResearchRequest["status"]> = {
    SUBMITTED: "SUBMITTED",
    ASSIGNED: "ASSIGNED",
    IN_PROGRESS: "IN_PROGRESS",
    DRAFT_SUBMITTED: "DRAFT_SUBMITTED",
    REVISION_REQUESTED: "REVISION_REQUESTED",
    REVISED: "REVISED",
    APPROVED: "APPROVED",
    DELIVERED: "DELIVERED",
    CLOSED: "CLOSED",
    OVERDUE: "OVERDUE",
  };

  return {
    id: r.requestNumber || r.id,
    title: r.title,
    topic: r.subject || r.title,
    category: r.category?.name || r.category || r.scope || "",
    member: r.submitter
      ? `${r.submitter.firstName} ${r.submitter.lastName}`
      : "",
    submitterId: r.submitterId || r.submitter?.id || null,
    assignedOfficerId: r.assignedOfficerId || null,
    assignedOfficerName: r.officer
      ? `${r.officer.firstName} ${r.officer.lastName}`
      : null,
    teamId: r.teamId || null,
    teamName: r.team?.name || null,
    assignedOfficers: (r.assignments || [])
      .filter((a: any) => a.assignedTo && !a.declinedAt && !a.supersededAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
      })),
    declinedAssignments: (r.assignments || [])
      .filter((a: any) => a.assignedTo && a.declinedAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
        reason: a.declineReason || null,
      })),
    previousOfficers: (r.assignments || [])
      .filter((a: any) => a.assignedTo && a.supersededAt && !a.declinedAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
        reason: a.declineReason || null,
      })),
    status: statusMap[r.status] || "SUBMITTED",
    priority: r.priority as ResearchRequest["priority"],
    dateSubmitted: formatDisplayDate(r.dateSubmitted),
    dateSubmittedRaw: r.dateSubmitted || null,
    deadline: formatDisplayDate(r.deadline),
    description: r.description,
    scope: r.scope || undefined,
    language: r.language || "English",
    draftVersion: r.draftVersion || 1,
    attachments: (r.attachments || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.fileType?.toLowerCase() || "pdf",
      size: a.fileSize
        ? `${(a.fileSize / 1024 / 1024).toFixed(1)} MB`
        : "Unknown",
      url: a.filePath,
    })),
    comments: (r.comments || []).map((c: any) => ({
      id: c.id,
      userName: c.author
        ? `${c.author.firstName} ${c.author.lastName}`
        : "Unknown",
      userInitials: c.author?.initials || "??",
      role: c.author?.role || "Unknown",
      time: new Date(c.createdAt).toLocaleString(),
      text: c.text,
      section: c.section || undefined,
      resolved: c.resolved,
    })),
    reportId: r.reports?.[0]?.id || null,
    content: r.reports?.[0]?.content || "",
    keyStakeholders: r.keyStakeholders || undefined,
    dataSources: r.dataSources || undefined,
    templateId: r.templateId || null,
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedUser = localStorage.getItem("prrms_user");
      return savedUser
        ? JSON.parse(savedUser)
        : {
            id: "",
            name: "",
            role: "MP" as Role,
            email: "",
            initials: "",
            title: "",
          };
    } catch {
      return {
        id: "",
        name: "",
        role: "MP" as Role,
        email: "",
        initials: "",
        title: "",
      };
    }
  });

  const [requests, setRequests] = useState<ResearchRequest[]>([]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("prrms_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  const [preferences, setPreferences] = useState<AppState["preferences"]>(
    () => {
      try {
        const savedPrefs = localStorage.getItem("prrms_prefs");
        return savedPrefs
          ? {
              ...{
                pushNotifications: true,
                emailSummaries: false,
                emailNotifications: true,
                whatsappNotifications: false,
                triggers: {
                  newAssignments: true,
                  statusChanges: true,
                  draftMentions: false,
                  deadlineReminders: true,
                },
              },
              ...JSON.parse(savedPrefs),
            }
          : {
              pushNotifications: true,
              emailSummaries: false,
              emailNotifications: true,
              whatsappNotifications: false,
              triggers: {
                newAssignments: true,
                statusChanges: true,
                draftMentions: false,
                deadlineReminders: true,
              },
            };
      } catch {
        return {
          pushNotifications: true,
          emailSummaries: false,
          emailNotifications: true,
          whatsappNotifications: false,
          triggers: {
            newAssignments: true,
            statusChanges: true,
            draftMentions: false,
            deadlineReminders: true,
          },
        };
      }
    },
  );

  const [isOnline, setIsOnline] = useState(false);

  // Check backend availability on mount
  useEffect(() => {
    checkHealth().then(setIsOnline);
  }, []);

  // Load notification preferences from backend when online
  useEffect(() => {
    if (!isOnline || !getToken()) return;
    getNotificationPrefs()
      .then((data: any) => {
        if (data) {
          const merged = {
            pushNotifications: true,
            emailSummaries: false,
            emailNotifications: true,
            whatsappNotifications: false,
            triggers: {
              newAssignments: true,
              statusChanges: true,
              draftMentions: false,
              deadlineReminders: true,
            },
            ...data,
          };
          setPreferences(merged);
          localStorage.setItem("prrms_prefs", JSON.stringify(merged));
        }
      })
      .catch((err: any) =>
        console.warn("Failed to load notification preferences:", err?.message),
      );
  }, [isOnline]);

  const mapNotification = (n: any): NotificationItem => {
    const typeMap: Record<string, NotificationItem["type"]> = {
      REQUEST_SUBMITTED: "RESEARCH",
      REQUEST_ASSIGNED: "COLLABORATION",
      REPORT_UPLOADED: "RESEARCH",
      REVISION_REQUESTED: "WARNING",
      REPORT_APPROVED: "CRITICAL",
      REPORT_DELIVERED: "CRITICAL",
      GENERAL: "RESEARCH",
    };
    return {
      id: n.id,
      title: n.title,
      message: n.message,
      time: new Date(n.createdAt).toLocaleString(),
      type: typeMap[n.type] || "RESEARCH",
      read: n.isRead,
      link: n.link,
      createdAt: n.createdAt,
    };
  };

  const fetchNotifications = useCallback(() => {
    if (!isOnline || !getToken()) return;
    getNotifications()
      .then((data: any) => {
        if (data?.notifications) {
          setNotifications(data.notifications.map(mapNotification));
        }
      })
      .catch((err: any) =>
        console.warn("Failed to load notifications:", err?.message),
      );
  }, [isOnline]);

  const fetchRequests = useCallback(async () => {
    if (!isOnline || !getToken()) return;
    const data = await getRequests();
    const requestList = Array.isArray(data)
      ? data
      : Array.isArray(data?.requests)
        ? data.requests
        : [];
    setRequests(requestList.map(mapApiRequest));
  }, [isOnline]);

  const refreshRequests = useCallback(async () => {
    await fetchRequests();
  }, [fetchRequests]);

  // Fetch data from API if online and token exists
  useEffect(() => {
    if (!isOnline || !getToken()) return;

    fetchRequests();

    fetchNotifications();

    getActivityLog({ limit: 20 })
      .then((data: any) => {
        const logs = data?.logs || [];
        const mapped: HistoryItem[] = logs.map((a: any) => ({
          id: a.id,
          userName: a.author
            ? `${a.author.firstName} ${a.author.lastName}`
            : "System",
          text: a.description || `${a.action} ${a.entityType}`,
          time: new Date(a.createdAt).toLocaleString(),
          sector: a.entityType,
          type: (a.action === "DELETE"
            ? "alert"
            : a.action === "UPDATE"
              ? "update"
              : "normal") as HistoryItem["type"],
        }));
        setHistory(mapped);
      })
      .catch((err: any) =>
        console.warn("Failed to load activity log:", err?.message),
      );

    getTemplates()
      .then((data: any) => {
        if (Array.isArray(data)) {
          setTemplates(data);
        }
      })
      .catch((err: any) =>
        console.warn("Failed to load templates:", err?.message),
      );
  }, [isOnline, currentUser.id]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isOnline || !getToken()) return;
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isOnline, fetchNotifications]);

  useEffect(() => {
    localStorage.setItem("prrms_user", JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem("prrms_requests", JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem("prrms_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("prrms_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem("prrms_prefs", JSON.stringify(preferences));
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
        constituency: data.user.constituency,
      };
      setCurrentUser(apiUser);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    logoutApi().catch((err) =>
      console.warn("Failed to log out on server:", err?.message),
    );
    clearToken();
    localStorage.removeItem("prrms_user");
    localStorage.removeItem("prrms_requests");
    localStorage.removeItem("prrms_notifications");
    localStorage.removeItem("prrms_history");
    setRequests([]);
    setNotifications([]);
    setHistory([]);
    setCurrentUser({
      id: "",
      name: "",
      role: "MP" as Role,
      email: "",
      initials: "",
      title: "",
    });
  };

  const switchUser = async (role: Role) => {
    // Fetch real user from API by role and re-authenticate
    if (isOnline) {
      try {
        const data = await getUsers({ role });
        if (data && Array.isArray(data) && data.length > 0) {
          const u = data[0];
          // Get a new JWT for the target user so backend sees correct identity
          const impersonateData = await impersonateUser(u.id);
          const apiUser: User = {
            id: impersonateData.user.id,
            name: `${impersonateData.user.firstName} ${impersonateData.user.lastName}`,
            role: impersonateData.user.role as Role,
            email: impersonateData.user.email,
            initials: impersonateData.user.initials,
            title: impersonateData.user.title || impersonateData.user.role,
            constituency: impersonateData.user.constituency,
          };
          setCurrentUser(apiUser);
          return;
        }
      } catch {
        // Fall through
      }
    }
  };

  const addRequest = async (
    newReqData: Omit<
      ResearchRequest,
      "id" | "dateSubmitted" | "draftVersion" | "comments" | "content"
    >,
  ): Promise<boolean> => {
    // Persist to backend if online
    if (isOnline) {
      try {
        await createRequest({
          title: newReqData.title,
          subject: newReqData.topic,
          description: newReqData.description || "",
          scope: newReqData.scope,
          keyStakeholders: newReqData.keyStakeholders,
          dataSources: newReqData.dataSources,
          language: newReqData.language,
          priority: newReqData.priority,
          deadline: newReqData.deadline,
          committeeId: (newReqData as any).committeeId,
          templateId: newReqData.templateId || undefined,
        });
        // Refresh requests from API
        const data = await getRequests();
        const requestList = Array.isArray(data)
          ? data
          : Array.isArray(data?.requests)
            ? data.requests
            : [];

        if (requestList.length > 0) {
          setRequests(requestList.map(mapApiRequest));
        } else {
          setRequests([]);
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const assignRequest = async (
    requestId: string,
    officerIds?: string[],
    teamId?: string,
    deadline?: string,
    notes?: string,
    action: "assign" | "reassign" | "add" = "assign",
  ) => {
    if (isOnline) {
      try {
        const fullReq = await getRequest(requestId);
        const internalId = fullReq?.id || requestId;
        const resolvedDeadline =
          deadline ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await createAssignment({
          requestId: internalId,
          assignedToIds: officerIds?.length ? officerIds : undefined,
          teamId,
          action,
          deadline: resolvedDeadline,
          notes,
        });
        await refreshRequests();
      } catch (err: any) {
        throw err;
      }
    }
  };

  const requestRevisionForRequest = async (
    requestId: string,
    commentText?: string,
  ) => {
    if (isOnline) {
      const req = requests.find((r) => r.id === requestId);
      if (req?.reportId) {
        await requestRevision({
          reportId: req.reportId,
          requestId,
          commentText,
        });
      }
    }

    setRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, status: "REVISION_REQUESTED" } : req,
      ),
    );

    if (isOnline) {
      fetchNotifications();
    }
  };

  const approveRequestForReview = async (requestId: string) => {
    if (isOnline) {
      const req = requests.find((r) => r.id === requestId);
      if (req?.reportId) {
        await approveReport({ reportId: req.reportId, requestId });
      }
    }

    setRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, status: "APPROVED" } : req,
      ),
    );

    if (isOnline) {
      fetchNotifications();
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: ResearchRequest["status"],
  ) => {
    // Map frontend status back to backend status
    const reverseStatusMap: Record<string, string> = {
      SUBMITTED: "SUBMITTED",
      ASSIGNED: "ASSIGNED",
      IN_PROGRESS: "IN_PROGRESS",
      DRAFT_SUBMITTED: "DRAFT_SUBMITTED",
      REVISION_REQUESTED: "REVISION_REQUESTED",
      REVISED: "REVISED",
      APPROVED: "APPROVED",
      DELIVERED: "DELIVERED",
      CLOSED: "CLOSED",
    };

    // Persist to backend if online
    let apiFailed = false;
    if (isOnline) {
      const req = requests.find((r) => r.id === requestId);
      try {
        if (status === "REVISION_REQUESTED" && req?.reportId) {
          await requestRevision({ reportId: req.reportId, requestId });
        } else if (status === "APPROVED" && req?.reportId) {
          await approveReport({ reportId: req.reportId, requestId });
        } else {
          const backendStatus = reverseStatusMap[status] || status;
          await updateRequest(requestId, { status: backendStatus });
        }
      } catch {
        apiFailed = true;
      }
    }

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, status };
        }
        return req;
      }),
    );

    if (!apiFailed) {
      fetchNotifications();
    }
  };

  const updateRequestPriority = async (
    requestId: string,
    priority: ResearchRequest["priority"],
  ) => {
    if (isOnline) {
      try {
        await updateRequest(requestId, { priority });
      } catch {
        return;
      }
    }

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, priority };
        }
        return req;
      }),
    );

    if (isOnline) {
      fetchNotifications();
    }
  };

  const extendRequestDeadline = async (
    requestId: string,
    newDeadline: string,
  ): Promise<boolean> => {
    if (isOnline) {
      try {
        await updateRequest(requestId, { deadline: newDeadline });
      } catch {
        return false;
      }
    }

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, deadline: newDeadline };
        }
        return req;
      }),
    );

    if (isOnline) {
      fetchNotifications();
    }

    return true;
  };

  const addComment = async (
    requestId: string,
    text: string,
    section?: string,
    highlightedText?: string,
    startOffset?: number,
    endOffset?: number,
    parentId?: string,
  ) => {
    const newComment: Comment = {
      id: "comment_" + Date.now(),
      userName:
        currentUser.name + (currentUser.role === "ADMIN" ? " (Admin)" : ""),
      userInitials: currentUser.initials,
      role:
        currentUser.role === "ADMIN"
          ? "Admin"
          : currentUser.role === "RESEARCH_OFFICER"
            ? "Researcher"
            : "Member",
      time: "Just now",
      text,
      section,
      highlightedText,
      resolved: false,
    };

    // Persist to backend if online
    if (isOnline) {
      const req = requests.find((r) => r.id === requestId);
      if (req?.reportId) {
        try {
          const created = await createReview({
            reportId: req.reportId,
            requestId,
            section: section || "",
            text,
            highlightedText,
            startOffset,
            endOffset,
            parentId,
          });
          newComment.id = created.id || newComment.id;
        } catch {
          // Fall through to local-only
        }
      }
    }

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            comments: [...req.comments, newComment],
          };
        }
        return req;
      }),
    );

    if (isOnline) {
      fetchNotifications();
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

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            comments: req.comments.map((c) =>
              c.id === commentId ? { ...c, resolved: true } : c,
            ),
          };
        }
        return req;
      }),
    );
  };

  const updateRequestContent = (requestId: string, content: string) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, content };
        }
        return req;
      }),
    );
  };

  const uploadAttachment = (requestId: string, attachment: Attachment) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            attachments: [...req.attachments, attachment],
          };
        }
        return req;
      }),
    );
  };

  const deleteAttachment = (requestId: string, name: string) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return {
            ...req,
            attachments: req.attachments.filter((a) => a.name !== name),
          };
        }
        return req;
      }),
    );
  };

  const markAllNotificationsRead = async () => {
    const prev = notifications;
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    if (isOnline) {
      try {
        await apiMarkAllRead();
      } catch {
        setNotifications(prev);
      }
    }
  };

  const markNotificationRead = (id: string) => {
    const prev = notifications;
    setNotifications((n) =>
      n.map((x) => (x.id === id ? { ...x, read: true } : x)),
    );
    if (isOnline) {
      apiMarkNotificationRead(id).catch(() => {
        setNotifications(prev);
      });
    }
  };

  const savePreferences = (
    push: boolean,
    email: boolean,
    emailRealTime: boolean,
    whatsapp: boolean,
    triggers: AppState["preferences"]["triggers"],
  ) => {
    const newPrefs = {
      pushNotifications: push,
      emailSummaries: email,
      emailNotifications: emailRealTime,
      whatsappNotifications: whatsapp,
      triggers,
    };
    setPreferences(newPrefs);
    if (isOnline) {
      updateNotificationPrefs(newPrefs).catch((err: any) =>
        console.warn("Failed to save notification preferences:", err?.message),
      );
    }
  };

  const addTemplate = async (
    name: string,
    description: string | undefined,
    category: string,
    sections: { heading: string; prompt: string }[],
  ) => {
    const created = await apiCreateTemplate({
      name,
      description,
      category,
      sections,
    });
    setTemplates((prev) => [created, ...prev]);
    return created;
  };

  const updateTemplate = async (
    id: string,
    name: string,
    description: string | undefined,
    category: string,
    sections: { heading: string; prompt: string }[],
  ) => {
    const updated = await apiUpdateTemplate(id, {
      name,
      description,
      category,
      sections,
    });
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const removeTemplate = async (id: string) => {
    await apiDeleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        requests,
        notifications,
        history,
        templates,
        preferences,
        isOnline,
        login,
        logout,
        switchUser,
        addRequest,
        assignRequest,
        refreshRequests,
        requestRevisionForRequest,
        approveRequestForReview,
        updateRequestStatus,
        updateRequestPriority,
        extendRequestDeadline,
        addComment,
        resolveComment,
        updateRequestContent,
        uploadAttachment,
        deleteAttachment,
        markAllNotificationsRead,
        markNotificationRead,
        savePreferences,
        addTemplate,
        updateTemplate,
        removeTemplate,
        updateProfile: async (updates) => {
          const data = await updateUserProfile(updates);
          if (data) {
            setCurrentUser((prev) => ({
              ...prev,
              name: `${data.firstName} ${data.lastName}`,
              initials: data.initials || prev.initials,
              title: data.title || prev.title,
              email: data.email || prev.email,
              ...(updates.constituency !== undefined && {
                constituency: updates.constituency,
              }),
            }));
          }
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
