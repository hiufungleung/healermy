'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useAuth } from '@/components/auth/AuthProvider';
import { PopupConfirmation } from './PopupConfirmation';
import { NotificationBell } from '../communications/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Home, Calendar, Users } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { MOBILE_BREAKPOINT } from '@/library/breakpoints';

interface LayoutProps {
  children: React.ReactNode;
  patientName?: string;
  providerName?: string;
  practitionerName?: string;
}

export function Layout({ children, patientName, providerName, practitionerName }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout, isLoading, userName, isLoadingUserName } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isPatient = session?.role === 'patient';
  const isProvider = session?.role === 'provider';
  const isPractitioner = session?.role === 'practitioner';

  // Use prop-based names first (no flicker), fallback to cached userName from AuthProvider
  const displayName = (isPatient ? patientName : isPractitioner ? practitionerName : providerName) || userName;

  // Close mobile menu when viewport changes to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

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

  const handleProfileClick = () => {
    const profilePath = isPatient ? '/patient/profile' : isPractitioner ? '/practitioner/profile' : '/provider/profile';
    router.push(profilePath);
  };

  // Remove Profile and Notification tabs from navigation
  const navItems = isPatient
    ? [
        { href: '/patient/dashboard', label: 'Dashboard', icon: Home },
        { href: '/patient/appointments', label: 'Appointments', icon: Calendar },
      ]
    : isProvider
    ? [
        { href: '/provider/dashboard', label: 'Dashboard', icon: Home },
        { href: '/provider/practitioner', label: 'Manage Practitioners', icon: Users },
        { href: '/provider/appointments', label: 'Appointments', icon: Calendar },
      ]
    : isPractitioner
    ? [
        { href: '/practitioner/dashboard', label: 'Dashboard', icon: Home },
        { href: '/practitioner/appointments', label: 'Appointments', icon: Calendar },
        { href: '/practitioner/workstation', label: 'Workstation', icon: Users },
      ]
    : [];

  // Get avatar initials
  const getAvatarInitials = () => {
    if (!session) return '';

    if (session.role === 'patient') {
      // Extract patient initials from displayName
      if (displayName && displayName !== 'Patient' && !displayName.startsWith('Patient ')) {
        const names = displayName.trim().split(' ');
        if (names.length >= 2) {
          return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        } else if (names.length === 1 && names[0].length > 0) {
          return names[0][0].toUpperCase();
        }
      }
      return 'P';
    } else if (session.role === 'provider') {
      return 'HP';
    } else if (session.role === 'practitioner') {
      // Extract practitioner initials from displayName
      if (displayName) {
        const names = displayName.trim().split(' ');
        if (names.length >= 2) {
          return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        } else if (names.length === 1 && names[0].length > 0) {
          return names[0][0].toUpperCase();
        }
      }
      return 'HP';
    }

    return '';
  };

  const avatarInitial = getAvatarInitials();

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Navigation - Always stays at top even during overscroll */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side: Mobile Menu Button and Logo */}
            <div className="flex items-center">
              {/* Mobile Menu Button - Animated Hamburger Icon */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors mr-2 relative z-50"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                <div className="w-5 h-4 flex flex-col justify-between relative">
                  <span
                    className={clsx(
                      "block w-full h-0.5 bg-current transition-all duration-300 ease-in-out",
                      mobileMenuOpen ? "rotate-45 translate-y-2" : ""
                    )}
                  ></span>
                  <span
                    className={clsx(
                      "block w-full h-0.5 bg-current transition-all duration-300 ease-in-out",
                      mobileMenuOpen ? "opacity-0" : "opacity-100"
                    )}
                  ></span>
                  <span
                    className={clsx(
                      "block w-full h-0.5 bg-current transition-all duration-300 ease-in-out",
                      mobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""
                    )}
                  ></span>
                </div>
              </button>

              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="flex items-center">
                  <span className="text-xl sm:text-2xl font-bold text-brand">HealerMy</span>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-8 md:flex md:space-x-6">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md',
                        pathname === item.href
                          ? 'text-primary bg-blue-50'
                          : 'text-gray-700 hover:text-primary hover:bg-gray-50'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side: User Menu */}
            <div className="flex items-center space-x-3">
              {session ? (
                <>
                  {/* Notification Bell */}
                  <NotificationBell className="rounded-full hover:bg-gray-100 transition-colors" />

                  {/* Avatar Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label="User menu"
                      >
                        {avatarInitial}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {isLoadingUserName ? (
                              <span className="inline-block animate-pulse bg-gray-200 rounded h-4 w-24"></span>
                            ) : (
                              displayName || 'User'
                            )}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {session.role === 'patient' ? 'Patient' : session.role === 'practitioner' ? 'Practitioner' : 'Provider'}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleLogoutClick}
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : isLoading ? (
                <div className="flex items-center space-x-4">
                  <div className="animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-4">
                  <Link href="/launch?role=patient" className="btn-outline text-sm">
                    Patient Login
                  </Link>
                  <Link href="/launch?role=provider" className="btn-primary text-sm">
                    Provider Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay with Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 z-40 md:hidden transition-opacity duration-150",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop - Click to close - Instant dark overlay (no blur) */}
        <div
          className="fixed inset-0 bg-black/60"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Mobile Menu Panel - Slides down simultaneously */}
        <div
          className={clsx(
            "fixed top-16 left-0 right-0 bg-white shadow-lg transition-all duration-300 ease-out",
            "max-h-[calc(100vh-4rem)] overflow-y-auto",
            mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          )}
        >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 text-base font-medium rounded-md transition-colors',
                      pathname === item.href
                        ? 'bg-blue-50 text-primary'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Profile Link in Mobile Menu */}
              {session && (
                <Link
                  href={isPatient ? '/patient/profile' : isPractitioner ? '/practitioner/profile' : '/provider/profile'}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 text-base font-medium rounded-md transition-colors',
                    pathname === (isPatient ? '/patient/profile' : isPractitioner ? '/practitioner/profile' : '/provider/profile')
                      ? 'bg-blue-50 text-primary'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  <span>Profile</span>
                </Link>
              )}

              {/* User Info in Mobile Menu */}
              {session && displayName && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-3 px-4">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                      {avatarInitial}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        {session.role === 'patient' ? 'Patient' : session.role === 'practitioner' ? 'Practitioner' : 'Provider'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Main Content - Add padding to account for fixed header (h-16 = 64px) */}
      <main className="pt-16">{children}</main>

      {/* Logout Confirmation Modal */}
      <PopupConfirmation
        isOpen={showLogoutConfirmation}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
        isLoading={isLoggingOut}
      />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
