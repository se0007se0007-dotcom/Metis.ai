import { PageHeader } from '@/components/shared/PageHeader';

export default function AuditLogPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="감사 로그"
        description="모든 상태 변경 이벤트의 불변 감사 추적"
      />
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="검색: correlation ID, 사용자, 액션..."
            className="flex-1 bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:outline-none"
          />
          <select className="bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-500">
            <option>전체 액션</option>
            <option>CREATE</option>
            <option>UPDATE</option>
            <option>DELETE</option>
            <option>EXECUTE</option>
            <option>POLICY_CHECK</option>
          </select>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 px-3">시간</th>
              <th className="py-2 px-3">액션</th>
              <th className="py-2 px-3">대상</th>
              <th className="py-2 px-3">사용자</th>
              <th className="py-2 px-3">정책</th>
              <th className="py-2 px-3">Correlation ID</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 text-gray-500">
              <td className="py-3 px-3" colSpan={6}>감사 로그 데이터가 표시됩니다 (API 연동 후)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
