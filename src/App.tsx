import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './lib/toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { LoginView } from './components/LoginView';
import { SupportView } from './components/SupportView';
import { GlobalSearch } from './components/GlobalSearch';
import { FileText, Loader2 } from 'lucide-react';
import { getToken } from './lib/api';

const AdminDashboardView = lazy(() => import('./components/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const MemberDashboardView = lazy(() => import('./components/MemberDashboardView').then(m => ({ default: m.MemberDashboardView })));
const NewRequestFormView = lazy(() => import('./components/NewRequestFormView').then(m => ({ default: m.NewRequestFormView })));
const AdminRevisionReviewView = lazy(() => import('./components/AdminRevisionReviewView').then(m => ({ default: m.AdminRevisionReviewView })));
const LegislativeBriefsView = lazy(() => import('./components/LegislativeBriefsView').then(m => ({ default: m.LegislativeBriefsView })));
const OfficerRevisionWorkspaceView = lazy(() => import('./components/OfficerRevisionWorkspaceView').then(m => ({ default: m.OfficerRevisionWorkspaceView })));
const NotificationsView = lazy(() => import('./components/NotificationsView').then(m => ({ default: m.NotificationsView })));
const OfficerWorkflowView = lazy(() => import('./components/OfficerWorkflowView').then(m => ({ default: m.OfficerWorkflowView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const StatisticsView = lazy(() => import('./components/StatisticsView').then(m => ({ default: m.StatisticsView })));
const ProjectsView = lazy(() => import('./components/ProjectsView').then(m => ({ default: m.ProjectsView })));
const MembersView = lazy(() => import('./components/MembersView').then(m => ({ default: m.MembersView })));
const ArchiveView = lazy(() => import('./components/ArchiveView').then(m => ({ default: m.ArchiveView })));
const ParliamentaryCalendarView = lazy(() => import('./components/ParliamentaryCalendarView').then(m => ({ default: m.ParliamentaryCalendarView })));
const ResearchTemplatesView = lazy(() => import('./components/ResearchTemplatesView').then(m => ({ default: m.ResearchTemplatesView })));
const DocumentVersionDiffView = lazy(() => import('./components/DocumentVersionDiffView').then(m => ({ default: m.DocumentVersionDiffView })));
const ActivityLogView = lazy(() => import('./components/ActivityLogView').then(m => ({ default: m.ActivityLogView })));
const MemberResearchReviewView = lazy(() => import('./components/MemberResearchReviewView').then(m => ({ default: m.MemberResearchReviewView })));
const TeamsView = lazy(() => import('./components/TeamsView').then(m => ({ default: m.TeamsView })));
const OfficerDashboardView = lazy(() => import('./components/OfficerDashboardView').then(m => ({ default: m.OfficerDashboardView })));

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  briefs: 'Review Research Briefs',
  new_request: 'Research Request Intake',
  notifications: 'Activity & Alert Center',
  workspace: 'Revision Workspace Editor',
  settings: 'System Configuration',
  statistics: 'Legislative Intelligence & Analytics',
  projects: 'Research Requests',
  members: 'Parliamentary Directories',
  archive: 'Document Archival Vault',
  calendar: 'Parliamentary Calendar',
  templates: 'Research Templates',
  'version-diff': 'Version Diff',
  audit: 'Activity Audit Log',
  review: 'Research Review Center',
  teams: 'Research Teams',
  workflow: 'Officer Workflow',
  support: 'Support',
};

function AppContent() {
  const { currentUser, logout } = useApp();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getToken());
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const currentView = currentPath === '/' ? 'dashboard' : currentPath.slice(1).split('/')[0];

  const handleNavigate = (view: string, targetId?: string) => {
    if (targetId) {
      navigate(`/${view}/${targetId}`);
    } else {
      navigate(`/${view}`);
    }
    setIsSidebarMobileOpen(false);
  };

  // Must go through the context logout: it clears the persisted token and
  // cached state. Flipping isLoggedIn alone left the token in localStorage, so
  // a page refresh silently signed the user back in.
  const handleSignOut = () => {
    logout();
    setIsLoggedIn(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  const getPageTitle = () => {
    const base = VIEW_TITLES[currentView] || 'PRRMS Platform';
    if (currentView === 'dashboard') {
      return currentUser.role === 'ADMIN'
        ? 'Admin Overview'
        : currentUser.role === 'RESEARCH_OFFICER'
          ? 'Officer Dashboard'
          : 'Parliamentary Member Portal';
    }
    return base;
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        if (currentUser.role === 'ADMIN') {
          return <AdminDashboardView onNavigate={handleNavigate} />;
        } else if (currentUser.role === 'RESEARCH_OFFICER') {
          return <OfficerDashboardView onNavigate={handleNavigate} />;
        } else {
          return <MemberDashboardView />;
        }

      case 'workflow':
        if (currentUser.role !== 'RESEARCH_OFFICER') {
          return <Navigate to="/dashboard" replace />;
        }
        const workflowRequestId = currentPath.split('/')[2] || '';
        return (
          <OfficerWorkflowView
            onNavigate={handleNavigate}
            initialRequestId={workflowRequestId || undefined}
          />
        );

      case 'briefs':
        if (currentUser.role === 'ADMIN') {
          const requestId = currentPath.split('/')[2] || '';
          if (requestId) {
            return (
              <AdminRevisionReviewView
                requestId={requestId}
                onBack={() => handleNavigate('briefs')}
              />
            );
          }
          return <LegislativeBriefsView onNavigate={handleNavigate} />;
        }
        if (currentUser.role === 'MP') {
          return <Navigate to="/review" replace />;
        }
        if (currentUser.role === 'RESEARCH_OFFICER') {
          return <Navigate to="/dashboard" replace />;
        }
        return (
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center space-y-4">
            <FileText className="w-12 h-12 text-[#0037b0] mx-auto" />
            <h3 className="text-lg font-bold text-gray-900">Research Briefs Catalog</h3>
            <p className="text-sm text-[#434655] max-w-md mx-auto">
              Review available peer-reviewed legal briefing documents compiled by the legislative services.
            </p>
            <button onClick={() => handleNavigate('dashboard')} className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded">
              Go to Active Workspace
            </button>
          </div>
        );

      case 'workspace':
        const wsRequestId = currentPath.split('/')[2] || '';
        if (!wsRequestId) {
          return <Navigate to="/workflow" replace />;
        }
        return (
          <OfficerRevisionWorkspaceView
            requestId={wsRequestId}
            onBack={() => handleNavigate('workflow', wsRequestId)}
          />
        );

      case 'new_request':
        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MP') {
          return (
            <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center space-y-4">
              <FileText className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="text-lg font-bold text-gray-900">Access Restricted</h3>
              <p className="text-sm text-[#434655] max-w-md mx-auto">
                Only administrators and members of parliament may submit research requests.
              </p>
              <button onClick={() => handleNavigate('dashboard')} className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded">
                Back to Dashboard
              </button>
            </div>
          );
        }
        return <NewRequestFormView onSuccess={() => handleNavigate('dashboard')} />;

      case 'notifications':
        return <NotificationsView onNavigate={handleNavigate} />;

      case 'support':
        return <SupportView />;

      case 'settings':
        return <SettingsView onSignOut={handleSignOut} />;

      case 'statistics':
        return <StatisticsView />;

      case 'projects':
        return <ProjectsView onNavigate={handleNavigate} />;

      case 'members':
        return <MembersView />;

      case 'archive':
        return <ArchiveView onNavigate={handleNavigate} />;

      case 'calendar':
        return <ParliamentaryCalendarView />;

      case 'templates':
        return <ResearchTemplatesView />;

      case 'version-diff':
        const reportId = currentPath.split('/')[2] || '';
        return reportId ? (
          <DocumentVersionDiffView reportId={reportId} onBack={() => handleNavigate('projects')} />
        ) : (
          <div className="text-center text-gray-400 py-20">
            <p className="text-sm">No report selected.</p>
            <button onClick={() => handleNavigate('projects')} className="text-[#0037b0] text-xs font-bold mt-2 hover:underline">Go to Research Requests</button>
          </div>
        );

      case 'audit':
        return <ActivityLogView />;

      case 'review':
        if (currentUser.role !== 'MP') {
          return <Navigate to="/dashboard" replace />;
        }
        return <MemberResearchReviewView />;

      case 'teams':
        if (currentUser.role !== 'ADMIN') {
          return <Navigate to="/dashboard" replace />;
        }
        return <TeamsView />;

      default:
        return (
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center">
            <h3 className="text-lg font-bold text-gray-900">Page Not Found</h3>
            <p className="text-xs text-gray-500 mt-1">The page you are looking for does not exist.</p>
            <button onClick={() => handleNavigate('dashboard')} className="mt-4 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded">
              Back to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex font-sans overflow-x-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {isSidebarMobileOpen && (
        <div
          onClick={() => setIsSidebarMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 lg:hidden transition-opacity duration-300"
        />
      )}

      <div className={`flex-1 pl-0 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-70'} flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out`}>
        <Topbar
          currentView={currentView}
          onNavigate={handleNavigate}
          title={getPageTitle()}
          onMenuClick={() => setIsSidebarMobileOpen(true)}
          onSignOut={handleSignOut}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        <GlobalSearch
          onNavigate={handleNavigate}
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />

        <main className="flex-1 pt-24 px-4 sm:px-6 lg:px-8 pb-12 overflow-y-auto max-w-[120rem] mx-auto w-full min-w-0">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#0037b0]" /></div>}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
