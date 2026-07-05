import type { Metadata } from 'next';
import { PlatformRouteGate } from '@/components/platform/PlatformRouteGate';

export const metadata: Metadata = {
  title: 'TaskEasy Platform Admin Console',
  description: 'Platform owner console for companies, billing, plans, support, security, and analytics.',
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformRouteGate>{children}</PlatformRouteGate>;
}
