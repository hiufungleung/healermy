'use client';

import React, { useState } from 'react';
import { Layout } from '@/components/common/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';

interface Notification {
  id: string;
  type: 'appointment_confirmed' | 'appointment_reminder' | 'test_results' | 'message' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

export default function PatientNotifications() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'appointments' | 'results' | 'messages' | 'system'>('all');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'appointment_confirmed',
      title: 'Appointment Confirmed',
      message: 'Your appointment with Dr. Sarah Johnson on Jan 15, 2025 at 10:30 AM has been confirmed.',
      timestamp: '2025-01-12T14:30:00Z',
      read: false,
      actionRequired: false
    },
    {
      id: '2',
      type: 'appointment_reminder',
      title: 'Appointment Reminder',
      message: 'You have an upcoming appointment with Dr. Michael Chen tomorrow at 2:15 PM.',
      timestamp: '2025-01-11T09:00:00Z',
      read: false,
      actionRequired: false
    },
    {
      id: '3',
      type: 'test_results',
      title: 'New Test Results Available',
      message: 'Your blood test results from your visit on Jan 8 are now available.',
      timestamp: '2025-01-10T16:45:00Z',
      read: true,
      actionRequired: true
    },
    {
      id: '4',
      type: 'message',
      title: 'Message from Dr. Rodriguez',
      message: 'Please schedule a follow-up appointment to discuss your recent test results.',
      timestamp: '2025-01-09T11:20:00Z',
      read: false,
      actionRequired: true
    },
    {
      id: '5',
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled maintenance on Jan 15 from 2:00 AM - 4:00 AM. Some features may be temporarily unavailable.',
      timestamp: '2025-01-08T10:00:00Z',
      read: true,
      actionRequired: false
    }
  ]);

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'appointment_confirmed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'appointment_reminder':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      case 'test_results':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-2.4-.322C9.584 20.11 8.592 21 7.5 21c-1.162 0-2.5-.897-2.5-2.197 0-.972.826-1.8 1.819-1.8.191 0 .377.021.558.064A6.978 6.978 0 016 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
    }
  };

  const getIconBackgroundColor = (type: Notification['type']) => {
    switch (type) {
      case 'appointment_confirmed':
        return 'bg-green-100';
      case 'appointment_reminder':
        return 'bg-yellow-100';
      case 'test_results':
        return 'bg-blue-100';
      case 'message':
        return 'bg-primary/10';
      case 'system':
        return 'bg-gray-100';
      default:
        return 'bg-gray-100';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (activeFilter) {
      case 'unread':
        return !notification.read;
      case 'appointments':
        return notification.type === 'appointment_confirmed' || notification.type === 'appointment_reminder';
      case 'results':
        return notification.type === 'test_results';
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const actionRequiredCount = notifications.filter(n => n.actionRequired && !n.read).length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">Notifications</h1>
            <p className="text-text-secondary">Stay updated with your healthcare information</p>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
            >
              Mark All as Read
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{unreadCount}</div>
              <div className="text-sm text-text-secondary">Unread Messages</div>
            </div>
          </Card>
          
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{actionRequiredCount}</div>
              <div className="text-sm text-text-secondary">Action Required</div>
            </div>
          </Card>
          
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-text-primary">{notifications.length}</div>
              <div className="text-sm text-text-secondary">Total Messages</div>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Card className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'appointments', label: 'Appointments', count: notifications.filter(n => n.type.includes('appointment')).length },
              { key: 'results', label: 'Test Results', count: notifications.filter(n => n.type === 'test_results').length }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </Card>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-text-secondary">No notifications found</p>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id}
                className={`hover:shadow-md transition-shadow ${!notification.read ? 'border-l-4 border-l-primary bg-blue-50/30' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-lg ${getIconBackgroundColor(notification.type)} flex items-center justify-center`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className={`text-lg font-semibold truncate ${!notification.read ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {notification.actionRequired && (
                            <Badge variant="warning" size="sm">Action Required</Badge>
                          )}
                          <span className="text-xs text-text-secondary">
                            {new Date(notification.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-sm text-text-secondary hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {/* Message Content */}
                    <div className="mb-3">
                      <p className="text-text-secondary text-sm leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                    
                    {/* Action Buttons */}
                    {notification.actionRequired && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {notification.type === 'test_results' && (
                            <Button variant="primary" size="sm" className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>View Results</span>
                            </Button>
                          )}
                          {notification.type === 'message' && (
                            <>
                              <Button variant="primary" size="sm" className="flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Book Follow-up</span>
                              </Button>
                              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                <span>Reply</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Load More */}
        {filteredNotifications.length > 0 && (
          <div className="text-center mt-8">
            <Button variant="outline">
              Load More Notifications
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}