import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  AlertTriangle,
  FileText,
  Target
} from 'lucide-react';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500 text-white',
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
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  DELIVERED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export const ParliamentaryCalendarView: React.FC = () => {
  const { requests } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

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
      !['APPROVED','DELIVERED','CLOSED'].includes(r.status)
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
    return (
      <div
        key={day}
        onClick={() => setSelectedDate(new Date(year, month, day))}
        className={`min-h-[80px] border border-gray-100 p-1 cursor-pointer transition-colors hover:bg-gray-50 ${
          selected ? 'bg-[#e5efff] ring-2 ring-[#0037b0] ring-inset' : ''
        } ${isToday(day) ? 'bg-blue-50/50' : ''}`}
      >
        <div className={`text-[10px] font-bold mb-1 ${isToday(day) ? 'text-[#0037b0]' : 'text-gray-500'}`}>
          {day}
        </div>
        {items.slice(0, 2).map((r) => (
          <div
            key={r.id}
            className={`text-[9px] px-1 py-0.5 rounded mb-0.5 truncate font-semibold border ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
          >
            {r.title.slice(0, 15)}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <h3 className="font-sans font-bold text-base text-[#191c1d]">
                {MONTH_NAMES[month]} {year}
              </h3>
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
              <div className="px-6 py-3 border-b border-gray-100">
                <h4 className="font-sans font-bold text-sm text-[#191c1d]">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h4>
              </div>
              <div className="p-6">
                {selectedDateRequests.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDateRequests.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-500">{r.id.slice(0, 8)}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center">No research deadlines on this date.</p>
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
                          {r.status.replace(/_/g, ' ')}
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
              <p className="text-[11px] text-gray-400 italic text-center py-6">No upcoming deadlines.</p>
            )}
          </div>

          {/* Calendar legend */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm">
            <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase mb-3">Legend</h4>
            <div className="space-y-1.5">
              {Object.entries(STATUS_COLORS).map(([status, cls]) => (
                <div key={status} className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${cls}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
