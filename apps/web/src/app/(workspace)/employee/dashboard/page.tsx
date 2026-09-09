'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeeDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks');
  }, [router]);

  return null;
}
