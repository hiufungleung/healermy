'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createColumns, AppointmentRow } from '../../appointments/columns';
import type { Appointment, Encounter } from '@/types/fhir';

type TimeFilter = 'all' | 'today' | 'upcoming-7' | 'upcoming' | 'past';
type StatusFilter = 'pending' | 'booked' | 'fulfilled' | 'cancelled';

interface PractitionerAppointmentsTabProps {
  practitionerId: string;
}

export default function PractitionerAppointmentsTab({ practitionerId }: PractitionerAppointmentsTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    practitionerName: false  // Hide practitioner column on practitioner-specific page
  });
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set());
  const [updatingActions, setUpdatingActions] = useState<Map<string, string>>(new Map());

  // Initialize filter state from URL params (default: today, no status)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);

  // Fetch appointments with practitioner filter - OPTIMIZED to 4 API calls
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[PRACTITIONER APPOINTMENTS] Starting optimized fetch with filters');

      // Build query parameters for appointments
      const appointmentParams = new URLSearchParams();
      appointmentParams.append('_sort', '-date');

      // CRITICAL: Add practitioner filter
      appointmentParams.append('practitioner', `Practitioner/${practitionerId}`);

      // Add time filter
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 1);

      switch (timeFilter) {
        case 'all':
          break;
        case 'today':
          appointmentParams.append('date', `ge${today.toISOString()}`);
          appointmentParams.append('date', `lt${todayEnd.toISOString()}`);
          break;
        case 'upcoming-7':
          const next7Days = new Date(today);
          next7Days.setDate(next7Days.getDate() + 7);
          appointmentParams.append('date', `ge${today.toISOString()}`);
          appointmentParams.append('date', `lt${next7Days.toISOString()}`);
          break;
        case 'upcoming':
          appointmentParams.append('date', `ge${today.toISOString()}`);
          break;
        case 'past':
          appointmentParams.append('date', `lt${today.toISOString()}`);
          break;
      }

      // Add status filter (comma-separated, no spaces)
      if (statusFilters.length > 0) {
        appointmentParams.append('status', statusFilters.join(','));
      }

      console.log('[PRACTITIONER APPOINTMENTS] ⏳ CALL 1: Fetching appointments...', appointmentParams.toString());

      // CALL 1: Fetch appointments
      const appointmentsResponse = await fetch(
        `/api/fhir/appointments?${appointmentParams.toString()}`,
        { credentials: 'include' }
      );

      if (!appointmentsResponse.ok) {
        throw new Error(`Failed to fetch appointments: ${appointmentsResponse.status}`);
      }

      const appointmentsData = await appointmentsResponse.json();
      const fetchedAppointments: Appointment[] = appointmentsData.appointments || [];
      console.log('[PRACTITIONER APPOINTMENTS] ✅ CALL 1 complete:', fetchedAppointments.length, 'appointments');

      // Extract IDs for batched calls
      const appointmentIds = fetchedAppointments.map(apt => apt.id).filter(Boolean) as string[];
      const patientIds = new Set<string>();
      const practitionerIds = new Set<string>();

      fetchedAppointments.forEach(apt => {
        apt.participant?.forEach(p => {
          const ref = p.actor?.reference;
          if (ref?.startsWith('Patient/')) {
            const id = ref.split('/')[1];
            if (id) patientIds.add(id);
          } else if (ref?.startsWith('Practitioner/')) {
            const id = ref.split('/')[1];
            if (id) practitionerIds.add(id);
          }
        });
      });

      console.log('[PRACTITIONER APPOINTMENTS] 📊 Extracted IDs:', {
        appointments: appointmentIds.length,
        patients: patientIds.size,
        practitioners: practitionerIds.size
      });

      // CALLS 2-4: Parallel fetch encounters, patients, practitioners
      console.log('[PRACTITIONER APPOINTMENTS] ⏳ CALLS 2-4: Fetching encounters, patients, practitioners...');

      const [encountersResponse, patientsResponse, practitionersResponse] = await Promise.all([
        appointmentIds.length > 0
          ? fetch(`/api/fhir/encounters?appointment=${appointmentIds.join(',')}`, { credentials: 'include' })
          : null,
        patientIds.size > 0
          ? fetch(`/api/fhir/patients?_id=${Array.from(patientIds).join(',')}`, { credentials: 'include' })
          : null,
        practitionerIds.size > 0
          ? fetch(`/api/fhir/practitioners?_id=${Array.from(practitionerIds).join(',')}`, { credentials: 'include' })
          : null,
      ]);

      // Map encounters by appointment ID
      const encountersByAppointment = new Map<string, Encounter>();
      if (encountersResponse?.ok) {
        const encountersData = await encountersResponse.json();
        const encounters: Encounter[] = encountersData.encounters || [];
        console.log('[PRACTITIONER APPOINTMENTS] ✅ CALL 2 complete:', encounters.length, 'encounters');
        encounters.forEach(enc => {
          if (enc.appointment && enc.appointment.length > 0) {
            const appointmentRef = enc.appointment[0].reference;
            if (appointmentRef) {
              const appointmentId = appointmentRef.split('/')[1];
              if (appointmentId) {
                encountersByAppointment.set(appointmentId, enc);
              }
            }
          }
        });
      }

      // Map patients by ID
      const patientsMap = new Map();
      if (patientsResponse?.ok) {
        const patientsData = await patientsResponse.json();
        const patients = patientsData.patients || [];
        console.log('[PRACTITIONER APPOINTMENTS] ✅ CALL 3 complete:', patients.length, 'patients');
        patients.forEach((p: any) => {
          if (p.id) patientsMap.set(p.id, p);
        });
      }

      // Map practitioners by ID
      const practitionersMap = new Map();
      if (practitionersResponse?.ok) {
        const practitionersData = await practitionersResponse.json();
        const practitioners = practitionersData.practitioners || [];
        console.log('[PRACTITIONER APPOINTMENTS] ✅ CALL 4 complete:', practitioners.length, 'practitioners');
        practitioners.forEach((pr: any) => {
          if (pr.id) practitionersMap.set(pr.id, pr);
        });
      }

      // Enhance appointments with patient, practitioner, and encounter data
      const enhanced = fetchedAppointments.map(apt => {
        // Get patient name
        const patientRef = apt.participant?.find(p =>
          p.actor?.reference?.startsWith('Patient/')
        );
        let patientName = 'Unknown Patient';
        if (patientRef?.actor?.reference) {
          const patientId = patientRef.actor.reference.split('/')[1];
          const patient = patientsMap.get(patientId);
          if (patient?.name?.[0]) {
            const name = patient.name[0];
            patientName = `${name.given?.[0] || ''} ${name.family || ''}`.trim();
          }
        }

        // Get practitioner name
        const practitionerRef = apt.participant?.find(p =>
          p.actor?.reference?.startsWith('Practitioner/')
        );
        let practitionerName = 'Unknown Practitioner';
        if (practitionerRef?.actor?.reference) {
          const practitionerId = practitionerRef.actor.reference.split('/')[1];
          const practitioner = practitionersMap.get(practitionerId);
          if (practitioner?.name?.[0]) {
            const name = practitioner.name[0];
            practitionerName = `${name.given?.[0] || ''} ${name.family || ''}`.trim();
          }
        }

        // Get encounter by appointment ID
        const encounter = apt.id ? encountersByAppointment.get(apt.id) : undefined;

        return {
          ...apt,
          patientName,
          practitionerName,
          encounter
        } as AppointmentRow;
      });

      console.log('[PRACTITIONER APPOINTMENTS] ✅ Enhanced', enhanced.length, 'appointments with data');
      setAppointments(enhanced);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [practitionerId, timeFilter, statusFilters]);

  // Fetch on mount and when filters change (single call, not duplicate)
  useEffect(() => {
    fetchAppointments();
  }, [practitionerId, timeFilter, statusFilters]);

  // Listen for refresh events from actions - update only changed appointment
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { appointmentId, updatedAppointment, updatedEncounter } = customEvent.detail || {};

      if (appointmentId && updatedAppointment) {
        // Update only the changed appointment in state (optimistic update)
        setAppointments(prev => prev.map(apt => {
          if (apt.id === appointmentId) {
            return {
              ...apt,
              ...updatedAppointment,
              encounter: updatedEncounter || apt.encounter
            };
          }
          return apt;
        }));
      } else {
        // Fallback to full refetch if no detail provided
        fetchAppointments();
      }
    };

    window.addEventListener('refresh-appointments', handleRefresh);
    return () => window.removeEventListener('refresh-appointments', handleRefresh);
  }, [fetchAppointments]); // Include fetchAppointments for fallback

  // Handlers for tracking updating rows
  const handleActionStart = useCallback((appointmentId: string, action: string) => {
    setUpdatingRows(prev => new Set(prev).add(appointmentId));
    setUpdatingActions(prev => new Map(prev).set(appointmentId, action));
  }, []);

  const handleActionEnd = useCallback((appointmentId: string) => {
    setUpdatingRows(prev => {
      const next = new Set(prev);
      next.delete(appointmentId);
      return next;
    });
    setUpdatingActions(prev => {
      const next = new Map(prev);
      next.delete(appointmentId);
      return next;
    });
  }, []);

  // Create columns with context for spinner display
  const columns = useMemo(() => createColumns({
    updatingRows,
    updatingActions,
    onActionStart: handleActionStart,
    onActionEnd: handleActionEnd
  }), [updatingRows, updatingActions, handleActionStart, handleActionEnd]);

  // Initialize table (following shadcn pattern exactly)
  const table = useReactTable({
    data: appointments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  // Toggle status filter
  const toggleStatusFilter = (status: StatusFilter) => {
    setStatusFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Time</label>
          <Tabs value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
            <TabsList>
              <TabsTrigger className='text-[13px]' value="today">Today</TabsTrigger>
              <TabsTrigger className='text-[13px]' value="upcoming-7">Upcoming 7 days</TabsTrigger>
              <TabsTrigger className='text-[13px]' value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger className='text-[13px]' value="past">Past</TabsTrigger>
              <TabsTrigger className='text-[13px]' value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Status Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Appointment Status</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilters.includes('pending') ? 'default' : 'outline'}
              onClick={() => toggleStatusFilter('pending')}
              className="text-[13px]"
            >
              Pending
            </Button>
            <Button
              variant={statusFilters.includes('booked') ? 'default' : 'outline'}
              onClick={() => toggleStatusFilter('booked')}
              className="text-[13px]"
            >
              Booked
            </Button>
            <Button
              variant={statusFilters.includes('fulfilled') ? 'default' : 'outline'}
              onClick={() => toggleStatusFilter('fulfilled')}
              className="text-[13px]"
            >
              Completed
            </Button>
            <Button
              variant={statusFilters.includes('cancelled') ? 'default' : 'outline'}
              onClick={() => toggleStatusFilter('cancelled')}
              className="text-[13px]"
            >
              Cancelled
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-white">
        {loading ? (
          <div className="w-full">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-[13px]">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {Array.from({ length: 20 }).map((_, index) => (
                  <TableRow key={index}>
                    {table.getAllColumns().map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-[13px]">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-[13px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No appointments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
