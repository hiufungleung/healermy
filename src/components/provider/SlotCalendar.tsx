'use client';

import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import type { Slot } from '@/types/fhir';
import type { EventInput } from '@fullcalendar/core';

interface SlotCalendarProps {
  slots: Slot[];
}

export function SlotCalendar({ slots }: SlotCalendarProps) {
  // Convert FHIR slots to FullCalendar events
  const events: EventInput[] = useMemo(() => {
    return slots.map((slot) => {
      // Map slot status to colors
      const getColorByStatus = (status: string) => {
        switch (status) {
          case 'free':
            return '#22C55E'; // Green
          case 'busy':
            return '#EF4444'; // Red
          case 'busy-unavailable':
            return '#6B7280'; // Gray
          case 'busy-tentative':
            return '#FFC107'; // Yellow
          case 'entered-in-error':
            return '#DC2626'; // Dark red
          default:
            return '#3B82F6'; // Blue
        }
      };

      return {
        id: slot.id,
        title: slot.status === 'free' ? 'Available' : 'Booked',
        start: slot.start,
        end: slot.end,
        backgroundColor: getColorByStatus(slot.status || 'free'),
        borderColor: getColorByStatus(slot.status || 'free'),
        extendedProps: {
          status: slot.status,
          slotId: slot.id,
          schedule: slot.schedule?.reference,
        },
      };
    });
  }, [slots]);

  // Event content customization
  const renderEventContent = (eventInfo: any) => {
    return (
      <div className="p-1 text-xs overflow-hidden">
        <div className="font-medium truncate">{eventInfo.event.title}</div>
        <div className="text-[10px] opacity-90">
          {new Date(eventInfo.event.start).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="p-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-sm">Available</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span className="text-sm">Booked</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span className="text-sm">Tentative</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded bg-gray-500"></div>
          <span className="text-sm">Unavailable</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Total Slots</div>
          <div className="text-2xl font-bold">{slots.length}</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-green-600">Available</div>
          <div className="text-2xl font-bold text-green-600">
            {slots.filter((s) => s.status === 'free').length}
          </div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-red-600">Booked</div>
          <div className="text-2xl font-bold text-red-600">
            {slots.filter((s) => s.status === 'busy').length}
          </div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-yellow-600">Tentative</div>
          <div className="text-2xl font-bold text-yellow-600">
            {slots.filter((s) => s.status === 'busy-tentative').length}
          </div>
        </div>
      </div>

      {/* FullCalendar */}
      <div className="fullcalendar-wrapper">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventContent={renderEventContent}
          slotMinTime="09:00:00"
          slotMaxTime="17:00:00"
          allDaySlot={false}
          height="auto"
          expandRows={true}
          nowIndicator={true}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          eventClick={(info) => {
            // Handle event click - could show slot details
            console.log('Slot clicked:', info.event.extendedProps);
          }}
          dateClick={(info) => {
            // Handle date click - could create new slot
            console.log('Date clicked:', info.dateStr);
          }}
        />
      </div>

      <style jsx global>{`
        .fullcalendar-wrapper {
          font-family: inherit;
        }

        .fc {
          font-size: 0.875rem;
        }

        .fc .fc-button {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          text-transform: capitalize;
          background-color: #3B82F6;
          border-color: #3B82F6;
        }

        .fc .fc-button:hover {
          background-color: #2563EB;
          border-color: #2563EB;
        }

        .fc .fc-button:disabled {
          background-color: #9CA3AF;
          border-color: #9CA3AF;
        }

        .fc .fc-button-primary:not(:disabled).fc-button-active {
          background-color: #1E40AF;
          border-color: #1E40AF;
        }

        .fc-theme-standard td,
        .fc-theme-standard th {
          border-color: #E5E7EB;
        }

        .fc-theme-standard .fc-scrollgrid {
          border-color: #E5E7EB;
        }

        .fc .fc-col-header-cell {
          background-color: #F9FAFB;
          font-weight: 600;
          padding: 0.75rem 0.5rem;
        }

        .fc .fc-daygrid-day-number {
          padding: 0.5rem;
        }

        .fc .fc-timegrid-slot {
          height: 3rem;
        }

        .fc-event {
          cursor: pointer;
          border-radius: 4px;
          padding: 2px;
        }

        .fc-event:hover {
          opacity: 0.9;
        }

        .fc .fc-timegrid-now-indicator-line {
          border-color: #EF4444;
          border-width: 2px;
        }

        .fc .fc-timegrid-now-indicator-arrow {
          border-color: #EF4444;
        }

        .fc-day-today {
          background-color: #EFF6FF !important;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 0.5rem;
          }

          .fc .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
          }

          .fc .fc-button {
            padding: 0.375rem 0.75rem;
            font-size: 0.75rem;
          }

          .fc .fc-timegrid-slot {
            height: 2rem;
          }
        }
      `}</style>
    </Card>
  );
}