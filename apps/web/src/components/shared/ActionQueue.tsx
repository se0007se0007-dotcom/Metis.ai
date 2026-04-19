'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

export type QueueItemPriority = 'low' | 'medium' | 'high';

export interface QueueItem {
  id: string;
  category: string;
  label: string;
  badge?: string | number;
  priority?: QueueItemPriority;
  href?: string;
  icon?: ReactNode;
}

interface ActionQueueProps {
  items: QueueItem[];
  onItemClick: (item: QueueItem) => void;
  title?: string;
}

const priorityConfig: Record<QueueItemPriority, { color: string; label: string }> = {
  low: { color: 'bg-blue-100 text-blue-700', label: '낮음' },
  medium: { color: 'bg-yellow-100 text-yellow-700', label: '중간' },
  high: { color: 'bg-red-100 text-red-700', label: '높음' },
};

export function ActionQueue({
  items,
  onItemClick,
  title = '작업 큐',
}: ActionQueueProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Organize items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, QueueItem[]>,
  );

  const categories = Object.keys(groupedItems).sort();
  const flatItems = categories.flatMap((cat) => groupedItems[cat]);

  // Keyboard navigation
  useEffect(() => {
    setMounted(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleItemSelect(flatItems[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flatItems, selectedIndex]);

  const handleItemSelect = (item: QueueItem) => {
    onItemClick(item);
    if (item.href) {
      router.push(item.href);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-4 bg-card border border-border rounded-lg p-4">
      {title && (
        <h3 className="text-sm font-semibold text-dark">
          {title} ({flatItems.length})
        </h3>
      )}

      {flatItems.length === 0 ? (
        <div className="py-8 px-4 text-center">
          <p className="text-sm text-muted-dark">작업이 없습니다.</p>
          <p className="text-xs text-muted-dark mt-1">
            모든 작업이 완료되었습니다. 좋은 일입니다!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category}>
              {/* Category Heading */}
              <h4 className="text-xs font-semibold text-muted-dark uppercase tracking-wide mb-2 px-2">
                {category}
              </h4>

              {/* Items in Category */}
              <div className="space-y-2">
                {groupedItems[category].map((item, idx) => {
                  const itemIndex = flatItems.indexOf(item);
                  const isSelected = selectedIndex === itemIndex;
                  const priorityConfig_ =
                    item.priority && priorityConfig[item.priority];

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                        'text-left text-sm',
                        isSelected
                          ? 'bg-table-alt border-l-2 border-accent text-dark'
                          : 'bg-light-bg hover:bg-table-alt border-l-2 border-transparent text-muted-dark',
                      )}
                      tabIndex={0}
                    >
                      {/* Icon */}
                      {item.icon && (
                        <div className="flex-shrink-0 text-muted-dark">
                          {item.icon}
                        </div>
                      )}

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark truncate">
                          {item.label}
                        </p>
                      </div>

                      {/* Badge and Priority */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.badge !== undefined && (
                          <span className="inline-flex items-center justify-center min-w-6 h-6 rounded-full bg-accent/10 text-xs font-semibold text-accent">
                            {item.badge}
                          </span>
                        )}
                        {priorityConfig_ && (
                          <span
                            className={clsx(
                              'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                              priorityConfig_.color,
                            )}
                          >
                            {priorityConfig_.label}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
