'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const router = useRouter();
  const { session, unreadCount } = useAuth();

  const handleClick = () => {
    // Determine the correct notifications page based on user role
    const notificationsPath = session?.role === 'provider'
      ? '/provider/notifications'
      : '/patient/notifications';

    // Check if we're already on the notifications page
    const currentPath = window.location.pathname;
    const targetUrl = `${notificationsPath}?filter=unread`;

    if (currentPath === notificationsPath) {
      // Already on notifications page, trigger refresh
      console.log('[BELL ICON] Dispatching refresh-notifications event');
      window.dispatchEvent(new CustomEvent('refresh-notifications'));
      // Then update URL and trigger filter change
      window.history.pushState({}, '', targetUrl);
      // Trigger a popstate event to notify components of URL change
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      // Navigate to notifications page with unread filter
      router.push(targetUrl);
    }
  };


  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center p-2 text-text-secondary hover:text-text-primary transition-colors ${className}`}
      title={unreadCount > 0 ? `${unreadCount} unread messages` : 'Messages'}
    >
      {/* Bell Icon */}
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}