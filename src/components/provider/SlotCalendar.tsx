'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Card } from '@/components/common/Card';
import { SlotDetailDialog } from '@/components/provider/SlotDetailDialog';
import { createFHIRDateTime } from '@/library/timezone';
import {
  SPECIALTY_LABELS,
  SERVICE_CATEGORY_LABELS,
  getServiceTypeLabel,
  type ServiceCategoryCode,
  type ServiceTypeCode,
  type SpecialtyCode,
} from '@/constants/fhir';
import type { Slot, Schedule } from '@/types/fhir';

interface Props {
  slots: Slot[];
  schedules: Schedule[];
  practitionerId: string;
  onSlotUpdate?: () => void;
}

export function SlotCalendar({ practitionerId, onSlotUpdate }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize view from URL parameter (default: timeGridWeek)
  const initialView = searchParams.get('view') === 'month' ? 'dayGridMonth' : 'timeGridWeek';

  // State
  const [slots, setSlots] = useState<Slot[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [view, setView] = useState(initialView);
  const [date, setDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const calendarRef = useRef<any>(null);

  // Fetch slots
  const getSlots = async (d: Date) => {
    // Get start of week (Monday)
    const day = d.getDay();
    const startDate = new Date(d);
    startDate.setDate(d.getDate() - day + (day === 0 ? -6 : 1));

    // Get start of next week (Monday + 7 days)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    // Format as YYYY-MM-DD using local date components (not UTC)
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Create FHIR datetime strings (beginning of day)
    const startISO = createFHIRDateTime(startStr, '00:00');
    const endISO = createFHIRDateTime(endStr, '00:00');

    const params = new URLSearchParams();
    params.append('schedule.actor', `Practitioner/${practitionerId}`);
    params.append('start', `ge${startISO}`);
    params.append('start', `lt${endISO}`);

    const res = await fetch(`/api/fhir/slots?${params}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setSlots(json.slots || []);
    }
  };

  // Fetch schedules
  const getSchedules = async (d: Date) => {
    // Get first day of current month
    const startDate = new Date(d.getFullYear(), d.getMonth(), 1);

    // Get first day of next month
    const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    // Format as YYYY-MM-DD (schedule API only accepts date without time)
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const params = new URLSearchParams();
    params.append('actor', `Practitioner/${practitionerId}`);
    params.append('date', `ge${startStr}`);
    params.append('date', `lt${endStr}`);

    const res = await fetch(`/api/fhir/schedules?${params}`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      setSchedules(json.schedules || []);
    }
  };

  // Update URL parameter when view changes
  const updateViewParam = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());

    // Convert FullCalendar view names to URL param values
    const viewParam = newView === 'dayGridMonth' ? 'month' : 'week';
    params.set('view', viewParam);

    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Load data - call schedules and slots simultaneously
  const load = async (v: string, d: Date) => {
    setView(v);
    setDate(d);

    // Update URL parameter
    updateViewParam(v);

    // Always fetch both simultaneously to avoid duplicates
    if (v === 'dayGridMonth') {
      // Month view only needs schedules, but fetch both to keep legend consistent
      await Promise.all([
        getSchedules(d),
        // Don't fetch slots for month view to avoid unnecessary API call
      ]);
    } else {
      // Week view needs both - fetch simultaneously
      await Promise.all([
        getSlots(d),
        getSchedules(d),
      ]);
    }
  };

  // Initial load - use view from URL or default to week
  useEffect(() => {
    load(initialView, new Date());
  }, []);

  // Auto refresh
  useEffect(() => {
    const timer = setInterval(() => load(view, date), 10000);
    return () => clearInterval(timer);
  }, [view, date]);

  // Colors
  const palette = [
    '#86EFAC/#16A34A', '#93C5FD/#2563EB', '#FCA5A5/#DC2626',
    '#FCD34D/#CA8A04', '#C4B5FD/#7C3AED', '#FDA4AF/#E11D48',
    '#67E8F9/#0891B2', '#FBB6CE/#DB2777', '#A7F3D0/#059669', '#BFD3FA/#1D4ED8'
  ];

  const allRefs = Array.from(new Set([
    ...slots.map(s => s.schedule?.reference).filter(Boolean),
    ...schedules.map(s => `Schedule/${s.id}`)
  ]));

  const getColor = (ref: string) => {
    const idx = allRefs.indexOf(ref);
    const [light, dark] = palette[idx % palette.length].split('/');
    return { light, dark };
  };

  // Events
  const events = view === 'dayGridMonth'
    ? schedules.flatMap(s => {
        const ref = `Schedule/${s.id}`;
        const color = getColor(ref);
        if (s.planningHorizon?.start && s.planningHorizon?.end) {
          return [{
            id: s.id,
            title: s.id || '',
            start: s.planningHorizon.start,
            end: s.planningHorizon.end,
            // display: 'background',  // Removed to allow multiple rows for overlapping schedules
            backgroundColor: color.light,
            borderColor: color.light,
            classNames: hovered && hovered !== ref ? ['dim'] : [],
          }];
        }
        return [];
      })
    : slots.map(s => {
        const ref = s.schedule?.reference || '';
        const color = getColor(ref);
        const busy = s.status === 'busy' || s.status?.startsWith('busy-');
        return {
          id: s.id,
          title: s.status === 'free' ? 'Available' : 'Booked',
          start: s.start,
          end: s.end,
          backgroundColor: busy ? color.dark : color.light,
          borderColor: busy ? color.dark : color.light,
          classNames: hovered && hovered !== ref ? ['dim'] : [],
          extendedProps: { slotId: s.id },
        };
      });

  // Legend
  const visible = view === 'dayGridMonth'
    ? new Set(schedules.map(s => s.id).filter(Boolean))
    : new Set(slots.map(s => s.schedule?.reference?.replace('Schedule/', '')).filter(Boolean));

  const legend = schedules
    .filter(s => visible.has(s.id || ''))
    .map(s => {
      const ref = `Schedule/${s.id}`;
      const specialtyCode = s.specialty?.[0]?.coding?.[0]?.code as SpecialtyCode | undefined;
      const categoryCode = s.serviceCategory?.[0]?.coding?.[0]?.code as ServiceCategoryCode | undefined;
      const typeCode = s.serviceType?.[0]?.coding?.[0]?.code as ServiceTypeCode | undefined;

      return {
        ref,
        id: s.id || '',
        specialty: specialtyCode ? SPECIALTY_LABELS[specialtyCode] : '-',
        category: categoryCode ? SERVICE_CATEGORY_LABELS[categoryCode] : '-',
        type: (categoryCode && typeCode) ? getServiceTypeLabel(categoryCode, typeCode) : '-',
        color: getColor(ref),
      };
    });

  return (
    <Card className="p-4">
      {/* Legend */}
      <div className="mb-4 pb-4 border-b">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {legend.map(item => (
            <div
              key={item.ref}
              className="flex items-start space-x-2 text-xs p-2 rounded hover:bg-gray-50 cursor-pointer"
              onMouseEnter={() => setHovered(item.ref)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex space-x-1 mt-0.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color.light }} />
                {view !== 'dayGridMonth' && (
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color.dark }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-gray-700 truncate">{item.id} {item.specialty}</div>
                {/* <div className="text-gray-600 truncate"></div> */}
                <div className="text-gray-500 truncate">{item.category}, {item.type}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {view === 'dayGridMonth' ? 'Schedule availability by day' : 'Light = Available, Dark = Booked'}
        </div>
      </div>

      {/* Stats */}
      {/* {view !== 'dayGridMonth' && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Total Slots</div>
            <div className="text-2xl font-bold">{slots.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm text-green-600">Available</div>
            <div className="text-2xl font-bold text-green-600">
              {slots.filter(s => s.status === 'free').length}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-sm text-red-600">Booked</div>
            <div className="text-2xl font-bold text-red-600">
              {slots.filter(s => s.status === 'busy').length}
            </div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg">
            <div className="text-sm text-yellow-600">Tentative</div>
            <div className="text-2xl font-bold text-yellow-600">
              {slots.filter(s => s.status === 'busy-tentative').length}
            </div>
          </div>
        </div>
      )} */}

      {/* Calendar */}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek', // timeGridDay removed
        }}
        events={events}
        eventContent={info => (
          <div className="p-1 text-xs overflow-hidden">
            <div className="font-medium truncate">{info.event.title}</div>
            <div className="text-[10px] opacity-90">
              {new Date(info.event.start!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
        slotMinTime="09:00:00"
        slotMaxTime="17:00:00"
        allDaySlot={false}
        height="auto"
        expandRows={true}
        nowIndicator={true}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventClick={info => {
          const id = info.event.extendedProps.slotId;
          const slot = slots.find(s => s.id === id);
          if (slot) setSelectedSlot(slot);
        }}
        datesSet={info => {
          // For month view, use middle date to get correct month
          // For week/day view, use middle date too to get correct week
          const targetDate = new Date((info.start.getTime() + info.end.getTime()) / 2);
          load(info.view.type, targetDate);
        }}
      />

      <style jsx global>{`
        .fc { font-size: 0.875rem; }
        .fc-bg-event { opacity: 1 !important; z-index: 1; }
        .fc-event.dim, .fc-bg-event.dim { opacity: 0.3 !important; z-index: 0; }
        .fc-bg-event:not(.dim) { opacity: 1 !important; z-index: 2 !important; }
        .fc-event:not(.dim) { opacity: 1 !important; z-index: 2 !important; }

        /* Navigation buttons (prev, next, today) - Blue */
        .fc .fc-button-group .fc-button,
        .fc .fc-today-button {
          padding: 0.5rem 1rem;
          background: #3B82F6;
          border-color: #3B82F6;
          color: white;
          font-weight: 500;
        }
        .fc .fc-button-group .fc-button:hover,
        .fc .fc-today-button:hover:not(:disabled) {
          background: #2563EB;
          border-color: #2563EB;
          color: white;
        }

        /* Today button when disabled (already on today) - Gray */
        .fc .fc-today-button:disabled {
          background: #E5E7EB !important;
          border-color: #D1D5DB !important;
          color: #9CA3AF !important;
          cursor: not-allowed;
        }

        /* View switch buttons (month/week) - Gray default, Blue active */
        .fc .fc-button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button) {
          padding: 0.5rem 1rem;
          background: #E5E7EB;
          border-color: #D1D5DB;
          color: #6B7280;
          font-weight: 500;
        }
        .fc .fc-button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button):hover {
          background: #D1D5DB;
          border-color: #9CA3AF;
          color: #374151;
        }
        .fc .fc-button-active {
          background: #3B82F6 !important;
          border-color: #3B82F6 !important;
          color: white !important;
          font-weight: 600;
        }

        .fc-theme-standard td, .fc-theme-standard th { border-color: #E5E7EB; }
        .fc .fc-col-header-cell { background: #F9FAFB; font-weight: 600; padding: 0.75rem 0.5rem; }
        .fc .fc-timegrid-slot { height: 3rem; }

        /* Make each schedule bar fill half/third of cell height */
        .fc-daygrid-day {
          height: 100px;
        }
        .fc-daygrid-event {
          height: 60px !important;
          margin: 0 !important;
          border-radius: 0px;
        }

        .fc-event { cursor: pointer; border-radius: 0px; padding: 0px; }
        .fc-event:hover { opacity: 0.9; }
      `}</style>

      {selectedSlot && (
        <SlotDetailDialog
          slot={selectedSlot}
          isOpen={!!selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSlotDeleted={() => {
            setSelectedSlot(null);
            load(view, date);
            onSlotUpdate?.();
          }}
          onAppointmentCancelled={() => {
            setSelectedSlot(null);
            load(view, date);
            onSlotUpdate?.();
          }}
        />
      )}
    </Card>
  );
}
