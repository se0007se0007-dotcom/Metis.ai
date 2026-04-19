'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Command as CommandIcon } from 'lucide-react';
import clsx from 'clsx';

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: React.ReactNode;
  shortcut?: string;
  onExecute: () => void;
  category?: string;
}

interface CommandPaletteProps {
  commands: Command[];
}

/**
 * Simple fuzzy search implementation
 */
function fuzzyMatch(query: string, target: string): boolean {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  let queryIdx = 0;
  let targetIdx = 0;

  while (queryIdx < queryLower.length && targetIdx < targetLower.length) {
    if (queryLower[queryIdx] === targetLower[targetIdx]) {
      queryIdx++;
    }
    targetIdx++;
  }

  return queryIdx === queryLower.length;
}

function filterCommands(
  commands: Command[],
  query: string,
): { category: string; items: Command[] }[] {
  if (!query.trim()) {
    // Return all commands grouped by category
    const grouped = commands.reduce(
      (acc, cmd) => {
        const cat = cmd.category || '기타';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(cmd);
        return acc;
      },
      {} as Record<string, Command[]>,
    );

    return Object.entries(grouped)
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  // Filter by fuzzy search
  const filtered = commands.filter((cmd) => {
    const searchableText = [
      cmd.label,
      cmd.description,
      ...(cmd.keywords || []),
    ]
      .filter(Boolean)
      .join(' ');

    return fuzzyMatch(query, searchableText);
  });

  // Group filtered results
  const grouped = filtered.reduce(
    (acc, cmd) => {
      const cat = cmd.category || '기타';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>,
  );

  return Object.entries(grouped)
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    setMounted(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when palette opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Handle keyboard navigation
  const groupedResults = filterCommands(commands, query);
  const flatResults = groupedResults.flatMap((g) => g.items);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setSelectedIndex(0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        flatResults[selectedIndex].onExecute();
        setOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
    }
  };

  if (!mounted) return null;

  const paletteContent = (
    <>
      {/* Dark Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => setOpen(false)}
      />

      {/* Command Palette Modal */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-[600px] max-h-[500px] bg-card border border-border rounded-lg shadow-2xl flex flex-col">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
          <Search size={20} className="text-muted-dark flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="명령 검색... (↑↓ 이동, Enter 실행, Esc 닫기)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-dark placeholder-muted-dark focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {flatResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <p className="text-sm text-muted-dark">결과를 찾을 수 없습니다.</p>
              <p className="text-xs text-muted-dark mt-1">
                다른 검색어로 시도해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {groupedResults.map((group) => (
                <div key={group.category}>
                  {/* Category Header */}
                  <div className="px-3 py-2 text-xs font-semibold text-muted-dark uppercase tracking-wide">
                    {group.category}
                  </div>

                  {/* Items */}
                  {group.items.map((cmd, idx) => {
                    const globalIdx = flatResults.indexOf(cmd);
                    const isSelected = selectedIndex === globalIdx;

                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.onExecute();
                          setOpen(false);
                          setQuery('');
                          setSelectedIndex(0);
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-left',
                          isSelected
                            ? 'bg-table-alt text-dark'
                            : 'text-muted-dark hover:bg-table-alt',
                        )}
                      >
                        {/* Icon */}
                        {cmd.icon && (
                          <div className="flex-shrink-0 text-muted-dark">
                            {cmd.icon}
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-dark">
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p className="text-xs text-muted-dark">
                              {cmd.description}
                            </p>
                          )}
                        </div>

                        {/* Shortcut */}
                        {cmd.shortcut && (
                          <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-dark bg-light-bg px-2 py-1 rounded">
                            <span className="font-mono">{cmd.shortcut}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        {flatResults.length > 0 && (
          <div className="border-t border-border px-6 py-3 flex items-center gap-2 text-xs text-muted-dark flex-shrink-0">
            <CommandIcon size={14} />
            <span>K를 눌러 명령 팔레트를 열 수 있습니다</span>
          </div>
        )}
      </div>
    </>
  );

  return open ? createPortal(paletteContent, document.body) : null;
}
