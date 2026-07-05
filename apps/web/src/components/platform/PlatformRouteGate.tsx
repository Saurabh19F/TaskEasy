'use client';

import { usePathname } from 'next/navigation';
import { PlatformShell } from './PlatformShell';

export function PlatformRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/platform/login') {
    return <>{children}</>;
  }
  return <PlatformShell>{children}</PlatformShell>;
}
