import React from 'react';
import { redirect } from 'next/navigation';
import { Layout } from '@/components/common/Layout';
import { getDashboardData } from './actions';
import DashboardClient from './DashboardClient';

export default async function PatientDashboard() {
  const { patient, appointments, session, error } = await getDashboardData();
  
  // If no session or error, redirect to login
  if (error || !session) {
    redirect('/');
  }
  
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Morning' : currentHour < 18 ? 'Afternoon' : 'Evening';
  
  // Extract patient information with better fallback
  const patientName = (() => {
    if (patient?.name?.[0]) {
      const given = patient.name[0]?.given?.join(' ') || '';
      const family = patient.name[0]?.family || '';
      const fullName = `${given} ${family}`.trim();
      if (fullName) return fullName;
    }
    
    // Fallback to patient ID if name is not available
    if (session?.patient) {
      return `Patient ${session.patient}`;
    }
    
    // Last resort fallback
    return 'Patient';
  })();
  
  return (
    <Layout patientName={patientName}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient 
          patient={patient}
          appointments={appointments}
          patientName={patientName}
          greeting={greeting}
        />
      </div>
    </Layout>
  );
}