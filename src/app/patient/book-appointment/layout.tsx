import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Appointment',
  description: 'Browse providers and book your healthcare appointment',
};

export default function BookAppointmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
