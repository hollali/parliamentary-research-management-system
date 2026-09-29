import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useDialogA11y } from '../lib/useDialogA11y';
import { formatRequestStatus } from '../lib/status';
import { honourable } from '../lib/format';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  AlertTriangle,
  FileText,
  Target,
  X,
  User,
  CheckCircle2,
  CalendarX2,
} from 'lucide-react';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-[#ba1a1a] text-white',
  STANDARD: 'bg-[#0037b0] text-white',
  HIGH: 'bg-[#ba1a1a] text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-green-500 text-white',
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  ASSIGNED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  DRAFT_SUBMITTED: 'bg-purple-100 text-purple-700 border-purple-200',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-700 border-orange-200',
  REVISED: 'bg-purple-100 text-purple-700 border-purple-200',
  OVERDUE: 'bg-red-100 text-red-700 border-red-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  DELIVERED: 'bg-green-100 text-green-700 border-green-200',
  MEMBER_CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const ParliamentaryCalendarView: React.FC = () => {
  const { requests, currentUser } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const detailDialogRef = useDialogA11y<HTMLDivElement>({
    onClose: () => setSelectedRequest(null),
    enabled: !!selectedRequest,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const isCompleted = (status: string) => ['APPROVED', 'DELIVERED', 'MEMBER_CONFIRMED', 'CLOSED'].includes(status);

  // Deadlines within the displayed month (for the summary chip)
  const monthDeadlines = useMemo(() => {
    const inMonth = requests.filter((r) => {
      if (!r.deadline) return false;
      const d = new Date(r.deadline);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      total: inMonth.length,
      urgent: inMonth.filter((r) => r.priority === 'URGENT').length,
      overdue: inMonth.filter((r) => new Date(r.deadline) < today && !isCompleted(r.status)).length,
    };
  }, [requests, year, month]);

  // Map deadlines to dates
  const deadlineMap = useMemo(() => {
    const map: Record<string, typeof requests> = {};
    requests.forEach((r) => {
      if (!r.deadline) return;
      const d = new Date(r.deadline);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [requests]);

  // Upcoming deadlines (next 30 days)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);
    return requests
      .filter((r) => r.deadline && new Date(r.deadline) >= now && new Date(r.deadline) <= horizon)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }, [requests]);

  // Overdue requests
  const overdueRequests = useMemo(() => {
    const now = new Date();
    return requests.filter((r) =>
      r.deadline && new Date(r.deadline) < now &&
      !['APPROVED', 'DELIVERED', 'MEMBER_CONFIRMED', 'CLOSED'].includes(r.status)
    );
  }, [requests]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedDateKey = selectedDate
    ? `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
    : '';
  const selectedDateRequests = selectedDate ? deadlineMap[selectedDateKey] || [] : [];

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const renderCell = (day: number) => {
    const key = `${year}-${month}-${day}`;
    const items = deadlineMap[key] || [];
    const selected = selectedDateKey === key;
    const cellIsToday = isToday(day);
    const dayDate = new Date(year, month, day);
    const pastCell = dayDate.getTime() < today.getTime();
    const hasOverdue = items.some((r) => !isCompleted(r.status) && (!r.deadline || new Date(r.deadline) < today));
    const hasUrgent = items.some((r) => r.priority === 'URGENT' && !isCompleted(r.status));
    return (
      <div
        key={day}
        onClick={() => setSelectedDate(new Date(year, month, day))}
        className={`min-h-[80px] border p-1 cursor-pointer transition-colors hover:bg-gray-50 ${
          selected ? 'bg-[#e5efff] ring-2 ring-[#0037b0] ring-inset border-transparent' : 'border-gray-100'
        } ${cellIsToday ? 'bg-blue-50/50' : ''} ${hasOverdue ? 'bg-[#fff5f4]' : ''}`}
      >
        <div
          className={`flex items-center justify-between mb-1 ${
            cellIsToday ? 'text-[#0037b0]' : pastCell ? 'text-gray-300' : 'text-gray-500'
          }`}
        >
          <span className="text-[10px] font-bold">{day}</span>
          {cellIsToday ? (
            <span className="text-[7px] font-bold uppercase bg-[#0037b0] text-white rounded-full px-1.5 py-0.5" title="Today">
              Today
            </span>
          ) : hasOverdue ? (
            <span className="text-[7px] font-bold uppercase bg-[#ba1a1a] text-white rounded-full px-1.5 py-0.5" title={`${items.filter((r) => !isCompleted(r.status)).length} overdue`}>
              O#{items.filter((r) => !isCompleted(r.status)).length}
            </span>
          ) : (
            items.length > 0 && (
              <span className="text-[8px] font-bold text-gray-400">{items.length}</span>
            )
          )}
        </div>
        {items.slice(0, 2).map((r) => (
          <div
            key={r.id}
            className={`text-[9px] px-1 py-0.5 rounded mb-0.5 truncate font-semibold border flex items-center gap-1 ${
              r.priority === 'URGENT' && !isCompleted(r.status)
                ? 'border-[#ba1a1a]/40 bg-[#ffdad6] text-[#93000a]'
                : STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
            title={`${r.title} — ${formatRequestStatus(r.status)}`}
          >
            {r.priority === 'URGENT' && !isCompleted(r.status) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] shrink-0" />
            )}
            <span className="truncate">{r.title.slice(0, 15)}</span>
          </div>
        ))}
        {items.length > 2 && (
          <div className="text-[9px] text-gray-400 font-bold">+{items.length - 2} more</div>
        )}
      </div>
    );
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="min-h-[80px] bg-gray-50/50" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(renderCell(d));
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Parliamentary Calendar</h2>
        <p className="font-sans text-sm text-[#434655] mt-1">Research deadlines mapped to the parliamentary schedule.</p>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Calendar grid */}
        <div className="flex-1">
          <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 gap-2">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <h3 className="font-sans font-bold text-base text-[#191c1d]">
                  {MONTH_NAMES[month]} {year}
                </h3>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">
                    {monthDeadlines.total} deadlines
                  </span>
                  {monthDeadlines.urgent > 0 && (
                    <span className="text-[9px] font-bold text-[#93000a] bg-[#ffdad6] rounded-full px-2 py-0.5">
                      {monthDeadlines.urgent} urgent
                    </span>
                  )}
                  {monthDeadlines.overdue > 0 && (
                    <span className="text-[9px] font-bold text-[#93000a] bg-[#ffdad6] rounded-full px-2 py-0.5">
                      {monthDeadlines.overdue} overdue
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="text-[11px] font-bold text-[#0037b0] hover:bg-blue-50 border border-[#c4c5d7] rounded-lg px-2.5 py-1 transition-colors cursor-pointer shrink-0"
                title="Jump to current month"
              >
                Today
              </button>
              <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center py-2 text-[10px] font-bold text-gray-400 uppercase">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells}
            </div>
          </div>

          {/* Selected date details */}
          {selectedDate && (
            <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm mt-4">
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <h4 className="font-sans font-bold text-sm text-[#191c1d]">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h4>
                {selectedDateRequests.length > 0 ? (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 shrink-0">
                    {selectedDateRequests.length} deadline{selectedDateRequests.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
              <div className="p-6">
                {selectedDate.getTime() < today.getTime() &&
                  selectedDateRequests.some((r) => !isCompleted(r.status)) && (
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-[#93000a] bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {selectedDateRequests.filter((r) => !isCompleted(r.status)).length} request
                      {selectedDateRequests.filter((r) => !isCompleted(r.status)).length === 1 ? '' : 's'} on this date
                      {isCompleted(selectedDateRequests[0]?.status) ? '' : ' are still open'}
                    </div>
                  )}
                {selectedDateRequests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDateRequests.map((r) => {
                      const open = !isCompleted(r.status);
                      const overdue = open && new Date(r.deadline) < today;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setSelectedRequest(r)}
                          className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 border cursor-pointer transition-all hover:shadow-sm ${
                            overdue || (r.priority === 'URGENT' && open)
                              ? 'border-[#ba1a1a]/30'
                              : 'border-gray-100'
                          }`}
                        >
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-gray-900 truncate">{r.title}</p>
                              {r.priority === 'URGENT' && open && (
                                <span className="text-[8px] font-bold uppercase text-white bg-[#ba1a1a] rounded-full px-1.5 py-0.5 shrink-0">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                              <User className="w-3 h-3" />
                              {honourable(r.member || '—')}
                              <span className="text-gray-300">|</span>
                              {r.id}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            overdue ? 'bg-red-100 text-red-700' :
                            open ? STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {formatRequestStatus(overdue ? 'OVERDUE' : r.status)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <CalendarX2 className="w-6 h-6 text-gray-300 mb-1.5" />
                    <p className="text-xs font-semibold text-gray-500">No research deadlines on this date</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 space-y-4">
          {/* Overdue alerts */}
          {overdueRequests.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h4 className="font-sans font-bold text-xs text-red-700 uppercase">
                  Overdue ({overdueRequests.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {overdueRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-[11px]">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[r.priority] || 'bg-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-red-800 truncate">{r.title}</p>
                      <p className="text-red-500 text-[10px]">
                        Due {new Date(r.deadline!).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming deadlines */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#0037b0]" />
              <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase">
                Upcoming Deadlines (30d)
              </h4>
            </div>
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {upcomingDeadlines.map((r) => {
                  const daysLeft = Math.ceil(
                    (new Date(r.deadline!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={r.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-gray-900 truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{r.id.slice(0, 8)}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          daysLeft <= 3 ? 'bg-red-100 text-red-700' :
                          daysLeft <= 7 ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {daysLeft}d
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {formatRequestStatus(r.status)}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          Due {new Date(r.deadline!).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-6">
                <CalendarX2 className="w-6 h-6 text-gray-300 mb-1.5" />
                <p className="text-[11px] font-semibold text-gray-500">No upcoming deadlines</p>
              </div>
            )}
          </div>

          {/* Calendar legend */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm">
            <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase mb-3">Legend</h4>
            <div className="space-y-1.5">
              {Object.entries(STATUS_COLORS).map(([status, cls]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${cls}`}>
                    {formatRequestStatus(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Request detail modal */}
      {selectedRequest && (
        <div
          ref={detailDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-request-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="bg-[#dce1ff] text-[#0039b5] text-xs font-bold px-2.5 py-1 rounded shrink-0">
                  {selectedRequest.id}
                </span>
                <h3 id="calendar-request-detail-title" className="font-sans font-bold text-gray-900 text-sm truncate">{selectedRequest.title}</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${STATUS_COLORS[selectedRequest.status] || 'bg-gray-100 text-gray-600'}`}>
                  {formatRequestStatus(selectedRequest.status)}
                </span>
                {selectedRequest.priority === 'URGENT' && !isCompleted(selectedRequest.status) && (
                  <span className="text-[10px] font-extrabold text-white bg-[#ba1a1a] px-2 py-0.5 rounded border border-[#ba1a1a] uppercase tracking-wider">
                    Urgent Priority
                  </span>
                )}
                {(() => {
                  if (isCompleted(selectedRequest.status))
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#006b2c] bg-green-50 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    );
                  const overdue = new Date(selectedRequest.deadline) < today;
                  if (overdue)
                    return (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#93000a] bg-[#ffdad6] rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    );
                  return null;
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member (MP)</span>
                  <p className="text-sm font-semibold text-[#191c1d] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    {honourable(selectedRequest.member || '—')}
                  </p>
                </div>
                {currentUser.role !== "MP" && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Team / Officer</span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {selectedRequest.teamName || selectedRequest.assignedOfficerName || 'Unassigned'}
                  </p>
                </div>
              )}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deadline</span>
                  <p className="text-sm font-semibold text-[#191c1d] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {new Date(selectedRequest.deadline).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</span>
                  <p className="text-sm font-semibold text-[#191c1d]">{selectedRequest.category || '—'}</p>
                </div>
              </div>

              {selectedRequest.description && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brief</span>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100 max-h-36 overflow-y-auto">
                    {selectedRequest.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
