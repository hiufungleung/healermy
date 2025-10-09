import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clinic Profile',
  description: 'Manage clinic information and settings',
};

export default function ProviderProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
