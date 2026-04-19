'use client';

import { ReactNode, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  value?: string;
  onValueChange?: (value: string) => void;
}

interface SearchToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  filters?: FilterConfig[];
  actions?: ReactNode;
  className?: string;
}

export function SearchToolbar({
  searchValue = '',
  onSearchChange,
  placeholder = 'Search...',
  filters,
  actions,
  className,
}: SearchToolbarProps) {
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  return (
    <div
      className={clsx(
        'flex items-center gap-3 bg-card border border-border rounded-lg p-3 shadow-sm',
        className,
      )}
    >
      {/* Search Input */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Search size={16} className="text-muted-dark flex-shrink-0" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-light-bg text-sm text-dark placeholder-muted-dark focus:outline-none rounded px-2 py-1"
        />
      </div>

      {/* Filters */}
      {filters && filters.length > 0 && (
        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <div key={filter.id} className="relative">
              <button
                onClick={() =>
                  setOpenFilterId(
                    openFilterId === filter.id ? null : filter.id,
                  )
                }
                className="flex items-center gap-2 px-3 py-2 bg-light-bg border border-border rounded hover:border-accent transition-colors text-xs text-muted-dark"
              >
                <span>{filter.label}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    openFilterId === filter.id ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {openFilterId === filter.id && (
                <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-10 min-w-max">
                  {filter.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        filter.onValueChange?.(option.value);
                        setOpenFilterId(null);
                      }}
                      className={clsx(
                        'block w-full text-left px-4 py-2 text-xs transition-colors',
                        filter.value === option.value
                          ? 'bg-table-alt text-accent font-semibold'
                          : 'text-muted-dark hover:bg-table-alt',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
