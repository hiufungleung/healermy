import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practitioner Management',
  description: 'View and manage healthcare practitioners',
};

export default function PractitionerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
