'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Root page: redirect to workbench if authenticated, login otherwise */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('metis_access_token');
    if (token) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1A2E]">
      <div className="text-gray-400">Loading...</div>
    </div>
  );
}
