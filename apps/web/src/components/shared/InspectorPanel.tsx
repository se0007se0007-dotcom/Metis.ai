'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

export interface InspectorTab {
  key: string;
  label: string;
  content: ReactNode;
}

interface InspectorPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tabs?: InspectorTab[];
  actions?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthMap = {
  sm: 'w-[400px]',
  md: 'w-[560px]',
  lg: 'w-[800px]',
};

export function InspectorPanel({
  open,
  onClose,
  title,
  children,
  tabs,
  actions,
  width = 'md',
}: InspectorPanelProps) {
  const [activeTabKey, setActiveTabKey] = useState(tabs?.[0]?.key ?? 'default');
  const [mounted, setMounted] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!open) return null;

  const panelContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-screen bg-card border-l border-border flex flex-col',
          'shadow-lg z-50 transition-transform duration-200',
          widthMap[width],
        )}
      >
        {/* Title Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-dark">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-dark hover:text-dark transition-colors p-1"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        {tabs && tabs.length > 0 && (
          <div className="flex border-b border-border bg-table-header flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTabKey(tab.key)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTabKey === tab.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-dark hover:text-dark',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tabs && tabs.length > 0
            ? tabs.find((t) => t.key === activeTabKey)?.content
            : children}
        </div>

        {/* Action Footer */}
        {actions && (
          <div className="border-t border-border px-6 py-4 flex gap-3 justify-end flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </>
  );

  return createPortal(panelContent, document.body);
}
