import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pre-Visit Summary',
  description: 'Review your health information before your appointment',
};

export default function PreVisitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
