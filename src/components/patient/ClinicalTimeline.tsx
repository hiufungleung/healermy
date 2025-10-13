'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';

export type TimelineEventType = 'encounter' | 'procedure' | 'diagnostic' | 'service-request' | 'observation';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description?: string;
  status?: string;
  category?: string;
  practitioner?: string;
  location?: string;
  details?: Record<string, any>;
}

interface ClinicalTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  onEventClick?: (event: TimelineEvent) => void;
}

type FilterType = 'all' | TimelineEventType;
type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';

const getEventIcon = (type: TimelineEventType): React.ReactNode => {
  switch (type) {
    case 'encounter':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
        </svg>
      );
    case 'procedure':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm5 10a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      );
    case 'diagnostic':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    case 'service-request':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
      );
    case 'observation':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

const getEventColor = (type: TimelineEventType): { bg: string; text: string; border: string } => {
  switch (type) {
    case 'encounter':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'procedure':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'diagnostic':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
    case 'service-request':
      return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
    case 'observation':
      return { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const filterByDateRange = (events: TimelineEvent[], range: DateRange): TimelineEvent[] => {
  if (range === 'all') return events;

  const now = new Date();
  const cutoff = new Date();

  switch (range) {
    case '7d':
      cutoff.setDate(now.getDate() - 7);
      break;
    case '30d':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoff.setDate(now.getDate() - 90);
      break;
    case '1y':
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return events.filter(event => new Date(event.date) >= cutoff);
};

export const ClinicalTimeline: React.FC<ClinicalTimelineProps> = ({
  events,
  loading = false,
  onEventClick,
}) => {
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.type === filterType);
    }

    // Filter by date range
    filtered = filterByDateRange(filtered, dateRange);

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, filterType, dateRange]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card className="h-32 bg-gray-100">
              <div className="h-full" />
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Type Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            variant={filterType === 'encounter' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('encounter')}
          >
            Visits
          </Button>
          <Button
            variant={filterType === 'diagnostic' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('diagnostic')}
          >
            Labs
          </Button>
          <Button
            variant={filterType === 'procedure' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('procedure')}
          >
            Procedures
          </Button>
          <Button
            variant={filterType === 'observation' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterType('observation')}
          >
            Observations
          </Button>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No events found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No clinical events match your current filters.
            </p>
          </div>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Events */}
          <div className="space-y-4">
            {filteredEvents.map((event, index) => {
              const colors = getEventColor(event.type);
              return (
                <div key={event.id} className="relative pl-12">
                  {/* Timeline dot */}
                  <div className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border ${colors.border} bg-white shadow`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}>
                      {getEventIcon(event.type)}
                    </span>
                  </div>

                  {/* Event Card */}
                  <Card
                    className={`border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md ${
                      onEventClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className="p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-text-primary">{event.title}</h4>
                          <p className="mt-1 text-sm text-text-secondary">{formatDate(event.date)}</p>
                        </div>
                        {event.status && (
                          <Badge
                            variant={
                              event.status === 'completed' || event.status === 'final' ? 'success' :
                              event.status === 'active' || event.status === 'in-progress' ? 'warning' :
                              'info'
                            }
                            size="sm"
                          >
                            {event.status}
                          </Badge>
                        )}
                      </div>

                      {event.description && (
                        <p className="mb-2 text-sm text-text-secondary">{event.description}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
                        {event.category && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            {event.category}
                          </span>
                        )}
                        {event.practitioner && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {event.practitioner}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
