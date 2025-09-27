'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { useAuth } from '@/components/auth/AuthProvider';
import { PopupConfirmation } from './PopupConfirmation';
import { NotificationBell } from '../communications/NotificationBell';

interface LayoutProps {
  children: React.ReactNode;
  patientName?: string;
  providerName?: string;
}

export function Layout({ children, patientName, providerName }: LayoutProps) {
  const pathname = usePathname();
  const { session, logout, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const isPatient = session?.role === 'patient';
  const isProvider = session?.role === 'provider';
  
  const handleLogoutClick = () => {
    setShowLogoutConfirmation(true);
  };
  
  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirmation(false);
    }
  };
  
  const handleLogoutCancel = () => {
    setShowLogoutConfirmation(false);
  };
  
  const navItems = isPatient
    ? [
        { href: '/patient/dashboard', label: 'Dashboard' },
        { href: '/patient/appointments', label: 'Appointment' },
        { href: '/patient/notifications', label: 'Notification' },
        { href: '/patient/profile', label: 'Profile' },
      ]
    : isProvider
    ? [
        { href: '/provider/dashboard', label: 'Dashboard' },
        { href: '/provider/practitioner', label: 'Manage Practitioners' },
        { href: '/provider/appointments', label: 'Appointments' },
        { href: '/provider/notifications', label: 'Notifications' },
        { href: '/provider/profile', label: 'Profile' },
      ]
    : [];
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="flex items-center">
                  <span className="text-2xl font-bold text-brand">HealerMy</span>
                </Link>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                      pathname === item.href
                        ? 'border-primary text-black'
                        : 'border-transparent text-black hover:text-black hover:font-bold hover:border-blue-500'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center">
              {session ? (
                <div className="flex items-center space-x-4">
                  <NotificationBell className="rounded-full hover:bg-gray-100" />
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                      {session.role === 'patient' ? 'P' : 'D'}
                    </div>
                    {/* Show loading skeleton if no name provided yet */}
                    {(session.role === 'patient' && !patientName) || (session.role === 'provider' && !providerName) ? (
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </div>
                    ) : (
                      <span className="text-sm font-medium">
                        {session.role === 'patient'
                          ? (patientName || 'Patient')
                          : (providerName || 'Provider')
                        }
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={handleLogoutClick}
                    className="text-sm text-text-secondary hover:text-text-primary"
                  >
                    Logout
                  </button>
                </div>
              ) : isLoading ? (
                <div className="flex items-center space-x-4">
                  <div className="animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-4">
                  <Link href="/launch?role=patient" className="btn-outline">
                    Patient Login
                  </Link>
                  <Link href="/launch?role=provider" className="btn-primary">
                    Provider Login
                  </Link>
                </div>
              )}
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden ml-4 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'block pl-3 pr-4 py-2 border-l-4 text-base font-medium',
                    pathname === item.href
                      ? 'bg-gray-50 border-black text-black font-bold'
                      : 'border-transparent text-black hover:bg-gray-50 hover:border-black hover:text-black hover:font-bold'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      
      {/* Main Content */}
      <main>{children}</main>
      
      {/* Logout Confirmation Modal */}
      <PopupConfirmation
        isOpen={showLogoutConfirmation}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
        isLoading={isLoggingOut}
      />
    </div>
  );
}