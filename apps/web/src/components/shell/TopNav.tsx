'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationStore, TopNavItem } from '@/stores/navigation';
import { api } from '@/lib/api-client';

const TOP_LINKS: { id: TopNavItem; label: string; href: string }[] = [
  { id: 'dashboard', label: '대시보드', href: '/workbench' },
  { id: 'coverage', label: 'Coverage Map', href: '/coverage' },
  { id: 'athene', label: 'Athene 바로가기', href: '/athene' },
  { id: 'agent-control', label: 'Agent 관리/통제', href: '/agent-control' },
];

export function TopNav() {
  const { activeTopNav, setActiveTopNav } = useNavigationStore();
  const [user, setUser] = useState<{email: string; role: string} | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get<{email: string; role: string}>('/auth/me');
        if (response) {
          setUser({
            email: response.email ?? '',
            role: response.role ?? '',
          });
        }
      } catch (error) {
        // auth/me may fail before login - this is expected
        // Gracefully set default user on auth/me failure
        const defaultEmail = typeof window !== 'undefined'
          ? localStorage.getItem('userEmail') || 'User'
          : 'User';
        setUser({
          email: defaultEmail,
          role: 'OPERATOR',
        });
      }
    };
    fetchUser();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark border-b border-white/[0.08] flex items-center justify-between px-6 h-[52px]">
      {/* Logo */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => router.push('/workbench')}
          className="font-extrabold text-lg text-accent tracking-tight hover:opacity-80 transition cursor-pointer"
        >
          Metis.AI
          <span className="text-white/60 font-normal text-[13px] ml-3">
            AgentOps Governance
          </span>
        </button>

        {/* Top navigation links */}
        <div className="flex gap-1 ml-6">
          {TOP_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => { setActiveTopNav(link.id); router.push(link.href); }}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all border border-transparent
                ${
                  activeTopNav === link.id
                    ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                    : 'text-muted hover:bg-white/[0.08] hover:text-white'
                }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>

      {/* User info (right side) */}
      <div className="text-xs text-muted flex items-center gap-3">
        <span className="px-2 py-1 bg-accent/10 text-accent rounded text-[10px] font-semibold">
          {user?.role ?? 'Loading...'}
        </span>
        <span>{user?.email ?? 'Loading...'}</span>
      </div>
    </nav>
  );
}
