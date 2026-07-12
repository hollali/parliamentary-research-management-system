import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './lib/toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { LoginView } from './components/LoginView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { MemberDashboardView } from './components/MemberDashboardView';
import { NewRequestFormView } from './components/NewRequestFormView';
import { AdminRevisionReviewView } from './components/AdminRevisionReviewView';
import { OfficerRevisionWorkspaceView } from './components/OfficerRevisionWorkspaceView';
import { NotificationsView } from './components/NotificationsView';
import { OfficerWorkflowView } from './components/OfficerWorkflowView';
import { SettingsView } from './components/SettingsView';
import { SupportView } from './components/SupportView';
import { StatisticsView } from './components/StatisticsView';
import { ProjectsView } from './components/ProjectsView';
import { MembersView } from './components/MembersView';
import { ArchiveView } from './components/ArchiveView';
import { CommitteeWorkbenchView } from './components/CommitteeWorkbenchView';
import { ParliamentaryCalendarView } from './components/ParliamentaryCalendarView';
import { ResearchTemplatesView } from './components/ResearchTemplatesView';
import { DocumentVersionDiffView } from './components/DocumentVersionDiffView';
import { GlobalSearch } from './components/GlobalSearch';
import { ActivityLogView } from './components/ActivityLogView';
import { FileText } from 'lucide-react';

function AppContent() {
  const { currentUser, requests } = useApp();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleNavigate = (view: string, targetId?: string) => {
    setCurrentView(view);
    if (targetId) {
      if (view === 'version-diff') {
        setSelectedReportId(targetId);
      } else {
        setSelectedRequestId(targetId);
      }
    }
    setIsSidebarMobileOpen(false);
  };

  // Global search shortcut (Ctrl/Cmd + K)
  useEffect(() => {
    if (!isLoggedIn) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLoggedIn]);

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return currentUser.role === 'ADMIN' 
          ? 'Admin Overview' 
          : currentUser.role === 'RESEARCH_OFFICER' 
            ? 'Officer Workspace' 
            : 'Parliamentary Member Portal';
      case 'briefs':
        return 'Review Legislative Briefs';
      case 'new_request':
        return 'Inquiry Intake System';
      case 'notifications':
        return 'Activity & Alert Center';
      case 'workspace':
        return 'Revision Workspace Editor';
      case 'settings':
        return 'System Configuration';
      case 'statistics':
        return 'Legislative Intelligence & Analytics';
      case 'projects':
        return 'Inquiry Pipeline Directory';
      case 'members':
        return 'Parliamentary Directories';
      case 'archive':
        return 'Document Archival Vault';
      case 'committees':
        return 'Committee Workbench';
      case 'calendar':
        return 'Parliamentary Calendar';
      case 'templates':
        return 'Research Templates';
      case 'version-diff':
        return 'Version Diff';
      case 'audit':
        return 'Activity Audit Log';
      default:
        return 'PRRMS Platform';
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // Render sub views based on currentView and role
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        if (currentUser.role === 'ADMIN') {
          return <AdminDashboardView onNavigate={handleNavigate} />;
        } else if (currentUser.role === 'RESEARCH_OFFICER') {
          return <OfficerWorkflowView onNavigate={handleNavigate} />;
        } else {
          return <MemberDashboardView />;
        }

      case 'briefs':
        if (currentUser.role === 'ADMIN') {
          return (
            <AdminRevisionReviewView 
              requestId={selectedRequestId} 
              onBack={() => handleNavigate('dashboard')} 
            />
          );
        } else {
          // If member or officer, direct them to workflow or view
          return (
            <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center space-y-4">
              <FileText className="w-12 h-12 text-[#0037b0] mx-auto" />
              <h3 className="text-lg font-bold text-gray-900">Legislative Briefs Catalog</h3>
              <p className="text-sm text-[#434655] max-w-md mx-auto">
                Review available peer-reviewed legal briefing documents compiled by the legislative services. Select active drafts from your workflow pipeline.
              </p>
              <button 
                onClick={() => handleNavigate('dashboard')}
                className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
              >
                Go to Active Workspace
              </button>
            </div>
          );
        }

      case 'workspace':
        return (
          <OfficerRevisionWorkspaceView 
            requestId={selectedRequestId} 
            onBack={() => handleNavigate('dashboard')} 
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
              <button 
                onClick={() => handleNavigate('dashboard')}
                className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
              >
                Back to Dashboard
              </button>
            </div>
          );
        }
        return <NewRequestFormView onSuccess={() => handleNavigate('dashboard')} />;

      case 'notifications':
        return <NotificationsView />;

      case 'support':
        return <SupportView />;

      case 'settings':
        return <SettingsView onSignOut={() => setIsLoggedIn(false)} />;

      case 'statistics':
        return <StatisticsView />;

      case 'projects':
        return <ProjectsView onNavigate={handleNavigate} />;

      case 'members':
        return <MembersView />;

      case 'archive':
        return <ArchiveView onNavigate={handleNavigate} />;

      case 'committees':
        return <CommitteeWorkbenchView onNavigate={handleNavigate} />;

      case 'calendar':
        return <ParliamentaryCalendarView />;

      case 'templates':
        return <ResearchTemplatesView />;

      case 'version-diff':
        return selectedReportId ? (
          <DocumentVersionDiffView reportId={selectedReportId} onBack={() => handleNavigate('projects')} />
        ) : (
          <div className="text-center text-gray-400 py-20">
            <p className="text-sm">No report selected.</p>
            <button onClick={() => handleNavigate('projects')} className="text-[#0037b0] text-xs font-bold mt-2 hover:underline">Go to Projects</button>
          </div>
        );

      case 'audit':
        return <ActivityLogView />;

      default:
        return (
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center">
            <h3 className="text-lg font-bold text-gray-900">Module Under Active Commissioning</h3>
            <p className="text-xs text-gray-500 mt-1">This module is being optimized for security and will be active in future sessions.</p>
            <button 
              onClick={() => handleNavigate('dashboard')}
              className="mt-4 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
            >
              Back to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex font-sans overflow-x-hidden">
      {/* Persistent / Toggleable Sidebar */}
      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Backdrop overlay for mobile sidebar */}
      {isSidebarMobileOpen && (
        <div 
          onClick={() => setIsSidebarMobileOpen(false)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Top Header and Main Content */}
      <div className={`flex-1 pl-0 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-70'} flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out`}>
        <Topbar 
          currentView={currentView} 
          onNavigate={handleNavigate} 
          title={getPageTitle()} 
          onMenuClick={() => setIsSidebarMobileOpen(true)}
          onSignOut={() => setIsLoggedIn(false)}
          onSearchClick={() => setIsSearchOpen(true)}
        />

        <GlobalSearch
          onNavigate={handleNavigate}
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
        
        {/* Dynamic page context */}
        <main className="flex-1 pt-24 px-4 sm:px-6 lg:px-10 pb-12 overflow-y-auto max-w-350 mx-auto w-full min-w-0">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

// All view components have been extracted to separate files in src/components/
// This file is intentionally left clean — see src/components/ for individual view files.

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
