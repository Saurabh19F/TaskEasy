import { redirect } from 'next/navigation';

export default function PlatformLoginRedirectPage() {
  redirect('/login/platform');
}
