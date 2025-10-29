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
import { ProviderAppointmentDialog } from '@/components/provider/ProviderAppointmentDialog';
import type { Appointment, Encounter } from '@/types/fhir';
import { getNowInAppTimezone } from '@/library/timezone';

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
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null); // For detail dialog

  // Initialize filter state from URL params (default: today, no status)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([]);

  // Fetch appointments with practitioner filter - OPTIMIZED to 1 API call using FHIR _include and _revinclude!
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {

      // Build query parameters for appointments
      const appointmentParams = new URLSearchParams();
      appointmentParams.append('_sort', '-date');

      // CRITICAL: Add practitioner filter
      appointmentParams.append('practitioner', `Practitioner/${practitionerId}`);

      // Add time filter
      const now = getNowInAppTimezone();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 1);

      switch (timeFilter) {
        case 'all':
          break;
        case 'today':
          appointmentParams.append('slot.start', `ge${today.toISOString()}`);
          appointmentParams.append('slot.start', `lt${todayEnd.toISOString()}`);
          break;
        case 'upcoming-7':
          const next7Days = new Date(today);
          next7Days.setDate(next7Days.getDate() + 7);
          appointmentParams.append('slot.start', `ge${today.toISOString()}`);
          appointmentParams.append('slot.start', `lt${next7Days.toISOString()}`);
          break;
        case 'upcoming':
          appointmentParams.append('slot.start', `ge${today.toISOString()}`);
          break;
        case 'past':
          appointmentParams.append('slot.start', `lt${today.toISOString()}`);
          break;
      }

      // Add status filter (comma-separated, no spaces)
      if (statusFilters.length > 0) {
        appointmentParams.append('status', statusFilters.join(','));
      }

      // Add _include parameters to fetch related resources in same request
      appointmentParams.append('_include', 'Appointment:patient');  // Include patients
      appointmentParams.append('_include', 'Appointment:actor');    // Include practitioners
      appointmentParams.append('_revinclude', 'Encounter:appointment'); // Include encounters

      

      // SINGLE CALL: Fetch appointments + patients + practitioners + encounters in ONE request!
      const batchBundle = {
        resourceType: 'Bundle',
        type: 'batch',
        entry: [{
          request: {
            method: 'GET',
            url: `Appointment?${appointmentParams.toString()}`
          }
        }]
      };

      const batchResponse = await fetch('/api/fhir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        credentials: 'include',
        body: JSON.stringify(batchBundle),
      });

      if (!batchResponse.ok) {
        throw new Error('Failed to fetch appointments with batch request');
      }

      const responseBundle = await batchResponse.json();

      // Extract the search result bundle from batch response
      const searchBundle = responseBundle.entry?.[0]?.resource;
      if (!searchBundle || !searchBundle.entry) {

        setAppointments([]);
        return;
      }

      // Separate appointments from included resources using search.mode
      const fetchedAppointments: Appointment[] = [];
      const patientsMap = new Map<string, any>();
      const practitionersMap = new Map<string, any>();
      const encountersByAppointment = new Map<string, Encounter>();

      searchBundle.entry.forEach((entry: any) => {
        const resource = entry.resource;
        const searchMode = entry.search?.mode; // 'match' for appointments, 'include' for related resources

        if (resource.resourceType === 'Appointment' && searchMode === 'match') {
          fetchedAppointments.push(resource);
        } else if (resource.resourceType === 'Patient') {
          patientsMap.set(resource.id, resource);
        } else if (resource.resourceType === 'Practitioner') {
          practitionersMap.set(resource.id, resource);
        } else if (resource.resourceType === 'Encounter') {
          // Map encounter to appointment ID
          if (resource.appointment?.[0]?.reference) {
            const appointmentId = resource.appointment[0].reference.split('/')[1];
            if (appointmentId) {
              encountersByAppointment.set(appointmentId, resource);
            }
          }
        }
      });

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

  // Listen for view detail events from table actions (event listener only registered once)
  useEffect(() => {
    const handleViewDetail = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { appointment } = customEvent.detail || {};

      if (appointment) {
        setSelectedAppointment(appointment);
      }
    };

    window.addEventListener('view-appointment-detail', handleViewDetail);
    return () => window.removeEventListener('view-appointment-detail', handleViewDetail);
  }, []); // Empty deps - event listener only registered once

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
          <Tabs value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)} suppressHydrationWarning>
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

      {/* Appointment Detail Dialog */}
      <ProviderAppointmentDialog
        appointment={selectedAppointment}
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
