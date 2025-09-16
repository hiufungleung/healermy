'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchUnreadCount = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/fhir/communications?unread=true', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Listen for message events to update count in real-time
  useEffect(() => {
    const handleMessageUpdate = () => {
      fetchUnreadCount();
    };

    window.addEventListener('messageUpdate', handleMessageUpdate);
    return () => window.removeEventListener('messageUpdate', handleMessageUpdate);
  }, []);

  const handleClick = () => {
    router.push('/patient/messages'); // or /provider/messages based on role
  };

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center p-2 text-text-secondary hover:text-text-primary transition-colors ${className}`}
      title={unreadCount > 0 ? `${unreadCount} unread messages` : 'Messages'}
      disabled={isLoading}
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
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute -top-1 -right-1 bg-blue-500 rounded-full h-2 w-2 animate-pulse"></span>
      )}
    </button>
  );
}