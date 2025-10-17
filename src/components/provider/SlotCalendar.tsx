'use client';

import React, { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { SlotDetailDialog } from '@/components/provider/SlotDetailDialog';
import type { Slot } from '@/types/fhir';
import type { EventInput } from '@fullcalendar/core';

interface SlotCalendarProps {
  slots: Slot[];
  onSlotUpdate?: () => void;
}

export function SlotCalendar({ slots, onSlotUpdate }: SlotCalendarProps) {
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showSlotDetail, setShowSlotDetail] = useState(false);

  // Generate a color palette for schedules
  const scheduleColors = useMemo(() => {
    const scheduleIds = Array.from(new Set(slots.map(s => s.schedule?.reference).filter(Boolean)));
    const colors: Record<string, { light: string; heavy: string }> = {};

    // Predefined color palette with light/heavy variants
    const palette = [
      { light: '#86EFAC', heavy: '#16A34A' }, // Green
      { light: '#93C5FD', heavy: '#2563EB' }, // Blue
      { light: '#FCA5A5', heavy: '#DC2626' }, // Red
      { light: '#FCD34D', heavy: '#CA8A04' }, // Yellow
      { light: '#C4B5FD', heavy: '#7C3AED' }, // Purple
      { light: '#FDA4AF', heavy: '#E11D48' }, // Pink
      { light: '#67E8F9', heavy: '#0891B2' }, // Cyan
      { light: '#FBB6CE', heavy: '#DB2777' }, // Rose
      { light: '#A7F3D0', heavy: '#059669' }, // Emerald
      { light: '#BFD3FA', heavy: '#1D4ED8' }, // Indigo
    ];

    scheduleIds.forEach((scheduleId, index) => {
      colors[scheduleId as string] = palette[index % palette.length];
    });

    return colors;
  }, [slots]);

  // Convert FHIR slots to FullCalendar events with schedule-based colors
  const events: EventInput[] = useMemo(() => {
    return slots.map((slot) => {
      const scheduleRef = slot.schedule?.reference || '';
      const colors = scheduleColors[scheduleRef] || { light: '#D1D5DB', heavy: '#6B7280' };

      // Use light color for free slots, heavy color for busy slots
      const isBusy = slot.status === 'busy' || slot.status?.startsWith('busy-');
      const color = isBusy ? colors.heavy : colors.light;

      return {
        id: slot.id,
        title: slot.status === 'free' ? 'Available' : 'Booked',
        start: slot.start,
        end: slot.end,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          status: slot.status,
          slotId: slot.id,
          schedule: scheduleRef,
        },
      };
    });
  }, [slots, scheduleColors]);

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

  // Get unique schedules for legend
  const uniqueSchedules = useMemo(() => {
    const scheduleIds = Array.from(new Set(slots.map(s => s.schedule?.reference).filter(Boolean)));
    return scheduleIds.map(id => ({
      id: id as string,
      colors: scheduleColors[id as string] || { light: '#D1D5DB', heavy: '#6B7280' }
    }));
  }, [slots, scheduleColors]);

  return (
    <Card className="p-3 md:p-4">
      {/* Legend - Schedule Colors */}
      <div className="mb-3 md:mb-4 pb-3 md:pb-4 border-b">
        <div className="text-xs md:text-sm font-semibold mb-2">Schedule Colors:</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {uniqueSchedules.map(schedule => (
            <div key={schedule.id} className="flex items-center space-x-2 text-xs">
              <div className="flex space-x-1">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: schedule.colors.light }}></div>
                <div className="w-3 h-3 md:w-4 md:h-4 rounded" style={{ backgroundColor: schedule.colors.heavy }}></div>
              </div>
              <span className="truncate" title={schedule.id}>{schedule.id.replace('Schedule/', '')}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">Light = Available, Dark = Booked</div>
      </div>

      {/* Summary Stats - Responsive sizing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-3 md:mb-4">
        <div className="bg-gray-50 p-2 md:p-3 rounded-lg">
          <div className="text-xs md:text-sm text-gray-600">Total Slots</div>
          <div className="text-lg md:text-xl sm:text-2xl font-bold">{slots.length}</div>
        </div>
        <div className="bg-green-50 p-2 md:p-3 rounded-lg">
          <div className="text-xs md:text-sm text-green-600">Available</div>
          <div className="text-lg md:text-xl sm:text-2xl font-bold text-green-600">
            {slots.filter((s) => s.status === 'free').length}
          </div>
        </div>
        <div className="bg-red-50 p-2 md:p-3 rounded-lg">
          <div className="text-xs md:text-sm text-red-600">Booked</div>
          <div className="text-lg md:text-xl sm:text-2xl font-bold text-red-600">
            {slots.filter((s) => s.status === 'busy').length}
          </div>
        </div>
        <div className="bg-yellow-50 p-2 md:p-3 rounded-lg">
          <div className="text-xs md:text-sm text-yellow-600">Tentative</div>
          <div className="text-lg md:text-xl sm:text-2xl font-bold text-yellow-600">
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
            // Find the slot by ID
            const slotId = info.event.extendedProps.slotId;
            const slot = slots.find(s => s.id === slotId);
            if (slot) {
              setSelectedSlot(slot);
              setShowSlotDetail(true);
            }
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

      {/* Slot Detail Dialog */}
      <SlotDetailDialog
        slot={selectedSlot}
        isOpen={showSlotDetail}
        onClose={() => {
          setShowSlotDetail(false);
          setSelectedSlot(null);
        }}
        onSlotDeleted={() => {
          setShowSlotDetail(false);
          setSelectedSlot(null);
          onSlotUpdate?.();
        }}
        onAppointmentCancelled={() => {
          setShowSlotDetail(false);
          setSelectedSlot(null);
          onSlotUpdate?.();
        }}
      />
    </Card>
  );
}