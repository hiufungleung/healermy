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
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'appointments' | 'results'>('all');
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
        return '✅';
      case 'appointment_reminder':
        return '🔔';
      case 'test_results':
        return '📋';
      case 'message':
        return '💬';
      case 'system':
        return '⚙️';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'appointment_confirmed':
        return 'success';
      case 'appointment_reminder':
        return 'warning';
      case 'test_results':
        return 'info';
      case 'message':
        return 'info';
      case 'system':
        return 'info';
      default:
        return 'info';
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
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className={`font-semibold ${!notification.read ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                          {notification.actionRequired && (
                            <Badge variant="warning" size="sm">Action Required</Badge>
                          )}
                        </div>
                        <p className="text-text-secondary text-sm mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-sm text-primary hover:underline"
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-sm text-text-secondary hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    {notification.actionRequired && (
                      <div className="mt-3 pt-3 border-t">
                        {notification.type === 'test_results' && (
                          <Button variant="primary" size="sm">
                            View Results
                          </Button>
                        )}
                        {notification.type === 'message' && (
                          <div className="flex space-x-2">
                            <Button variant="primary" size="sm">
                              Book Follow-up
                            </Button>
                            <Button variant="outline" size="sm">
                              Reply
                            </Button>
                          </div>
                        )}
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