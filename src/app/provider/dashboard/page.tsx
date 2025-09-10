import React from 'react';
import { redirect } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { getProviderDashboardData } from './actions';
import ProviderDashboardClient from './ProviderDashboardClient';

export default async function ProviderDashboard() {
  const { provider, session, providerName, error } = await getProviderDashboardData();
  
  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }
  
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';
  
  return (
    <Layout providerName={providerName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProviderDashboardClient 
          provider={provider}
          session={session}
          providerName={providerName}
          greeting={greeting}
        />
      </div>
    </Layout>
  );
}