import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  label = "entries",
  trailing,
  actions,
}) => {
  if (totalItems === 0) {
    return (
      <div className="px-4 lg:px-6 py-6 bg-[#f3f4f5]/40 border-t border-[#c4c5d7] text-center">
        <p className="text-xs font-semibold text-[#434655]">No {label} to display</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          When new records are added, they will appear here.
        </p>
      </div>
    );
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="px-4 lg:px-6 py-3 bg-[#f3f4f5]/40 border-t border-[#c4c5d7] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#434655]">
      <span className="text-xs font-semibold">
        Showing {start}–{end} of {totalItems} {label}
        {trailing}
      </span>
      {(actions || totalPages > 1) && (
        <div className="flex items-center gap-3">
          {actions}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-[10px] font-bold text-[#434655] border border-[#c4c5d7] rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-7 h-7 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                      currentPage === page
                        ? "bg-[#0037b0] text-white"
                        : "text-[#434655] border border-[#c4c5d7] hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-[10px] font-bold text-[#434655] border border-[#c4c5d7] rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
