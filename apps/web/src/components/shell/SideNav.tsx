'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Target,
  CreditCard,
  Shield,
  Wrench,
  Code,
  Bot,
  Plug,
  Package,
  BookOpen,
  Palette,
  Radio,
  Rocket,
  BarChart3,
  DollarSign,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  FileArchive,
  Activity,
  Users,
  Waves,
  Store,
  Monitor,
  FileText,
  Bug,
  RefreshCw,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api-client';

/**
 * Active color per section — matches original prototype
 * .active-home, .active-agent, .active-l4 (governance), .active-l5 (knowledge),
 * .active-flo (orchestration), .active-admin
 */
function getActiveClasses(section: string): string {
  switch (section) {
    case 'home':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
    case 'agent':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
    case 'governance':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
    case 'knowledge':
      return 'bg-[rgba(6,214,160,0.15)] text-[#06D6A0] border-l-[#06D6A0] font-semibold';
    case 'orchestration':
      return 'bg-[rgba(255,183,3,0.08)] text-[#FFB703] border-l-[#FFB703] font-semibold';
    case 'insights':
      return 'bg-[rgba(6,214,160,0.15)] text-[#06D6A0] border-l-[#06D6A0] font-semibold';
    case 'missions':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
    case 'workspaces':
      return 'bg-[rgba(6,214,160,0.15)] text-[#06D6A0] border-l-[#06D6A0] font-semibold';
    case 'release':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
    case 'admin':
      return 'bg-[rgba(160,160,160,0.15)] text-[#a0a0a0] border-l-[#a0a0a0] font-semibold';
    default:
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8] border-l-[#00B4D8] font-semibold';
  }
}

function getBadgeClasses(color?: string): string {
  switch (color) {
    case 'cyan':
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8]';
    case 'green':
      return 'bg-[rgba(6,214,160,0.15)] text-[#06D6A0]';
    case 'red':
      return 'bg-[rgba(239,71,111,0.15)] text-[#EF476F]';
    case 'gold':
      return 'bg-[rgba(255,183,3,0.12)] text-[#FFB703]';
    default:
      return 'bg-[rgba(0,180,216,0.15)] text-[#00B4D8]';
  }
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
  visibleTo: string[];
  badge?: number | string;
  badgeColor?: string;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

/**
 * Navigation structure — matches MetisAI_v1.1.html prototype
 *
 * Original sections:
 *   Home → Agent Execution → Governance → 운영지식관리 → Orchestration → 시스템
 *
 * Extended with:
 *   Missions, Workspaces (purpose-oriented), Insights, Release
 */
const navigationGroups: NavGroup[] = [
  // ── Home ──
  {
    groupLabel: 'Home',
    items: [
      {
        id: 'home',
        label: '대시보드',
        href: '/home',
        icon: <Home size={18} />,
        section: 'home',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER', 'AUDITOR', 'VIEWER'],
      },
    ],
  },
  // ── Agent Execution (원본) ──
  {
    groupLabel: 'Agent Execution',
    items: [
      {
        id: 'agent-ops',
        label: '운영 Agent',
        href: '/workspaces/ops',
        icon: <Wrench size={18} />,
        section: 'agent',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
        badge: 18,
        badgeColor: 'cyan',
      },
      {
        id: 'agent-dev',
        label: '개발 Agent',
        href: '/workspaces/dev',
        icon: <Code size={18} />,
        section: 'agent',
        visibleTo: ['DEVELOPER', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
        badge: 12,
        badgeColor: 'green',
      },
      {
        id: 'agent-qa',
        label: '품질/공통 Agent',
        href: '/platform/agents',
        icon: <CheckCircle size={18} />,
        section: 'agent',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
        badge: 3,
        badgeColor: 'cyan',
      },
      {
        id: 'agent-util',
        label: '편의 Agent',
        href: '/workspaces/ap',
        icon: <Sparkles size={18} />,
        section: 'agent',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
        badge: 4,
        badgeColor: 'cyan',
      },
    ],
  },
  // ── Missions ──
  {
    groupLabel: 'Missions',
    items: [
      {
        id: 'missions-active',
        label: '활성 미션',
        href: '/missions',
        icon: <Target size={18} />,
        section: 'missions',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
      },
      {
        id: 'missions-history',
        label: '미션 이력',
        href: '/missions/history',
        icon: <ClipboardList size={18} />,
        section: 'missions',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
      },
    ],
  },
  // ── Governance (원본) ──
  {
    groupLabel: 'Governance',
    items: [
      {
        id: 'gov-log',
        label: 'AI 활동 로그',
        href: '/governance/audit',
        icon: <Activity size={18} />,
        section: 'governance',
        visibleTo: ['AUDITOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'OPERATOR'],
        badge: '1,247',
        badgeColor: 'cyan',
      },
      {
        id: 'gov-policy',
        label: '정책코드 엔진',
        href: '/governance/policies',
        icon: <ShieldCheck size={18} />,
        section: 'governance',
        visibleTo: ['TENANT_ADMIN', 'PLATFORM_ADMIN'],
        badge: 7,
        badgeColor: 'cyan',
      },
      {
        id: 'gov-evidence',
        label: 'Evidence Pack',
        href: '/governance/evidence',
        icon: <FileArchive size={18} />,
        section: 'governance',
        visibleTo: ['AUDITOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
      {
        id: 'gov-kpi',
        label: 'KPI 대시보드',
        href: '/governance/kpi',
        icon: <BarChart3 size={18} />,
        section: 'governance',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
    ],
  },
  // ── 운영지식관리 (원본) ──
  {
    groupLabel: '운영지식관리',
    items: [
      {
        id: 'knowledge-registry',
        label: 'Knowledge Registry',
        href: '/knowledge/registry',
        icon: <BookOpen size={18} />,
        section: 'knowledge',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
        badge: '2,456',
        badgeColor: 'green',
      },
      {
        id: 'knowledge-artifact',
        label: 'Artifact 관리',
        href: '/knowledge/artifacts',
        icon: <FileText size={18} />,
        section: 'knowledge',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
      {
        id: 'knowledge-pattern',
        label: 'Agent 오류 패턴 관리',
        href: '/knowledge/patterns',
        icon: <Bug size={18} />,
        section: 'knowledge',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
        badge: 14,
        badgeColor: 'red',
      },
      {
        id: 'knowledge-pipeline',
        label: 'Knowledge Pipeline',
        href: '/knowledge/pipeline',
        icon: <RefreshCw size={18} />,
        section: 'knowledge',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
    ],
  },
  // ── Orchestration (원본 — Metis.flo) ──
  {
    groupLabel: 'Orchestration',
    items: [
      {
        id: 'flo-builder',
        label: '워크플로우 빌더',
        href: '/orchestration/builder',
        icon: <Waves size={18} />,
        section: 'orchestration',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
        badge: 'NEW',
        badgeColor: 'gold',
      },
      {
        id: 'flo-market',
        label: '템플릿 마켓',
        href: '/orchestration/market',
        icon: <Store size={18} />,
        section: 'orchestration',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN', 'DEVELOPER'],
      },
      {
        id: 'flo-monitor',
        label: '실행 모니터링',
        href: '/orchestration/monitor',
        icon: <Monitor size={18} />,
        section: 'orchestration',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
      {
        id: 'flo-connectors',
        label: '커넥터 관리',
        href: '/orchestration/connectors',
        icon: <Plug size={18} />,
        section: 'orchestration',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
    ],
  },
  // ── Insights (확장) ──
  {
    groupLabel: 'Insights',
    items: [
      {
        id: 'insights-finops',
        label: 'FinOps',
        href: '/insights/finops',
        icon: <DollarSign size={18} />,
        section: 'insights',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
      {
        id: 'insights-anomalies',
        label: 'Anomalies',
        href: '/insights/anomalies',
        icon: <AlertTriangle size={18} />,
        section: 'insights',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
      {
        id: 'insights-risk',
        label: 'Risk 워크스페이스',
        href: '/workspaces/risk',
        icon: <Shield size={18} />,
        section: 'insights',
        visibleTo: ['OPERATOR', 'TENANT_ADMIN'],
      },
    ],
  },
  // ── Release (확장) ──
  {
    groupLabel: 'Release',
    items: [
      {
        id: 'release-hub',
        label: 'Release Hub',
        href: '/platform/release',
        icon: <Rocket size={18} />,
        section: 'release',
        visibleTo: ['DEVELOPER', 'TENANT_ADMIN', 'PLATFORM_ADMIN'],
      },
    ],
  },
  // ── 시스템 (원본) ──
  {
    groupLabel: '시스템',
    items: [
      {
        id: 'admin-users',
        label: '사용자 관리',
        href: '/admin/users',
        icon: <Users size={18} />,
        section: 'admin',
        visibleTo: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
      },
    ],
  },
];

export function SideNav() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState('OPERATOR');

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await api.get<{ role: string }>('/auth/me');
        if (response?.role) {
          setUserRole(response.role);
        }
      } catch {
        setUserRole('OPERATOR');
      }
    };
    fetchUserRole();
  }, []);

  function isVisible(visibleTo: string[]): boolean {
    return visibleTo.includes(userRole);
  }

  return (
    <aside className="w-60 min-w-[240px] bg-sidebar border-r border-white/[0.06] py-5 fixed top-[52px] bottom-0 left-0 overflow-y-auto flex flex-col">
      {navigationGroups.map((group, gi) => {
        const visibleItems = group.items.filter((item) => isVisible(item.visibleTo));
        if (visibleItems.length === 0) return null;

        // 시스템 section gets pushed to bottom
        const isSystem = group.groupLabel === '시스템';

        return (
          <div key={group.groupLabel} className={isSystem ? 'mt-auto' : ''}>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[1.5px] px-5 pt-3 pb-2 mt-2">
              {group.groupLabel}
            </div>
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const activeClasses = isActive ? getActiveClasses(item.section) : '';
              const badgeClasses = item.badgeColor ? getBadgeClasses(item.badgeColor) : '';

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-medium border-l-[3px] border-l-transparent transition-all
                    ${
                      isActive
                        ? activeClasses
                        : 'text-[#9ca3af] hover:bg-white/[0.03] hover:text-white'
                    }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge !== null && (
                    <span
                      className={`ml-auto text-[10px] px-2 py-1 rounded-full font-semibold ${badgeClasses}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
