import React from 'react';
import { redirect } from 'next/navigation';
import { getProviderSessionOnly } from './actions';
import ProviderDashboardWrapper from './ProviderDashboardWrapper';

export default async function ProviderDashboard() {
  const { session, error } = await getProviderSessionOnly();

  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }

  return (
    <ProviderDashboardWrapper
      session={session}
    />
  );
}