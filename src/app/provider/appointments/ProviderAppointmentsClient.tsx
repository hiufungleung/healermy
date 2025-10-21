'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { columns, AppointmentRow } from './columns';
import type { Appointment, Encounter } from '@/types/fhir';

type TimeFilter = 'all' | 'today' | 'upcoming-7' | 'upcoming' | 'past';
type StatusFilter = 'pending' | 'booked' | 'fulfilled' | 'cancelled';

export default function ProviderAppointmentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Initialize filter state from URL params (default: today, no status)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    const time = searchParams.get('time');
    if (time && ['all', 'today', 'upcoming-7', 'upcoming', 'past'].includes(time)) {
      return time as TimeFilter;
    }
    return 'today';
  });

  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>(() => {
    const status = searchParams.get('status');
    if (status) {
      const statuses = status.split(',').filter(s =>
        ['pending', 'booked', 'fulfilled', 'cancelled'].includes(s)
      );
      return statuses as StatusFilter[];
    }
    return [];
  });

  // Fetch all appointments with filters - OPTIMIZED to 4 API calls
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[APPOINTMENTS] Starting optimized fetch with filters');

      // Build query parameters for appointments
      const appointmentParams = new URLSearchParams();
      appointmentParams.append('_sort', '-date');

      // Add time filter
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 1);

      switch (timeFilter) {
        case 'all':
          // No date filter for 'all'
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

      // CALL 1: Fetch appointments with filters
      const appointmentsResponse = await fetch(
        `/api/fhir/appointments?${appointmentParams.toString()}`,
        { credentials: 'include' }
      );

      if (!appointmentsResponse.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const appointmentsData = await appointmentsResponse.json();
      const fetchedAppointments: Appointment[] = appointmentsData.appointments || [];
      console.log('[APPOINTMENTS] ✅ Call 1/4: Fetched', fetchedAppointments.length, 'appointments');

      // Extract appointment IDs, patient IDs, and practitioner IDs
      const appointmentIds = fetchedAppointments.map(apt => apt.id).filter(Boolean);
      const patientIds = new Set<string>();
      const practitionerIds = new Set<string>();

      fetchedAppointments.forEach(apt => {
        // Extract patient ID
        const patientRef = apt.participant?.find(p =>
          p.actor?.reference?.startsWith('Patient/')
        );
        if (patientRef?.actor?.reference) {
          const patientId = patientRef.actor.reference.split('/')[1];
          patientIds.add(patientId);
        }

        // Extract practitioner ID
        const practitionerRef = apt.participant?.find(p =>
          p.actor?.reference?.startsWith('Practitioner/')
        );
        if (practitionerRef?.actor?.reference) {
          const practitionerId = practitionerRef.actor.reference.split('/')[1];
          practitionerIds.add(practitionerId);
        }
      });

      // CALLS 2-4: Fetch encounters, patients, and practitioners in parallel
      const [encountersResponse, patientsResponse, practitionersResponse] = await Promise.all([
        // Call 2: Fetch encounters by appointment IDs
        appointmentIds.length > 0
          ? fetch(
              `/api/fhir/encounters?appointment=${appointmentIds.join(',')}`,
              { credentials: 'include' }
            )
          : null,

        // Call 3: Fetch patients by IDs
        patientIds.size > 0
          ? fetch(
              `/api/fhir/patients?_id=${Array.from(patientIds).join(',')}`,
              { credentials: 'include' }
            )
          : null,

        // Call 4: Fetch practitioners by IDs
        practitionerIds.size > 0
          ? fetch(
              `/api/fhir/practitioners?_id=${Array.from(practitionerIds).join(',')}`,
              { credentials: 'include' }
            )
          : null,
      ]);

      // Process encounters
      const encountersByAppointment = new Map<string, Encounter>();
      if (encountersResponse?.ok) {
        const encountersData = await encountersResponse.json();
        const encounters: Encounter[] = encountersData.encounters || [];
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
        console.log('[APPOINTMENTS] ✅ Call 2/4: Fetched', encounters.length, 'encounters');
      } else {
        console.log('[APPOINTMENTS] ⏭️  Call 2/4: Skipped (no appointments)');
      }

      // Process patients
      const patientsMap = new Map<string, any>();
      if (patientsResponse?.ok) {
        const patientsData = await patientsResponse.json();
        const patients = patientsData.patients || [];
        patients.forEach((patient: any) => {
          if (patient.id) patientsMap.set(patient.id, patient);
        });
        console.log('[APPOINTMENTS] ✅ Call 3/4: Fetched', patients.length, 'patients');
      } else {
        console.log('[APPOINTMENTS] ⏭️  Call 3/4: Skipped (no patients)');
      }

      // Process practitioners
      const practitionersMap = new Map<string, any>();
      if (practitionersResponse?.ok) {
        const practitionersData = await practitionersResponse.json();
        const practitioners = practitionersData.practitioners || [];
        practitioners.forEach((practitioner: any) => {
          if (practitioner.id) practitionersMap.set(practitioner.id, practitioner);
        });
        console.log('[APPOINTMENTS] ✅ Call 4/4: Fetched', practitioners.length, 'practitioners');
      } else {
        console.log('[APPOINTMENTS] ⏭️  Call 4/4: Skipped (no practitioners)');
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

      console.log('[APPOINTMENTS] ✅ Enhanced', enhanced.length, 'appointments with data');
      setAppointments(enhanced);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [timeFilter, statusFilters]);

  // Update URL when filters change
  const updateURL = useCallback((time: TimeFilter, statuses: StatusFilter[]) => {
    const params = new URLSearchParams();

    // Only add time param if not default (today)
    if (time !== 'today') {
      params.set('time', time);
    }

    // Only add status param if not empty
    if (statuses.length > 0) {
      params.set('status', statuses.join(','));
    }

    const newURL = params.toString() ? `?${params.toString()}` : '/provider/appointments';
    router.push(newURL);
  }, [router]);

  // Sync URL when filters change
  useEffect(() => {
    updateURL(timeFilter, statusFilters);
  }, [timeFilter, statusFilters, updateURL]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Listen for refresh events from actions
  useEffect(() => {
    const handleRefresh = () => {
      fetchAppointments();
    };

    window.addEventListener('refresh-appointments', handleRefresh);
    return () => window.removeEventListener('refresh-appointments', handleRefresh);
  }, [fetchAppointments]);

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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Appointments
        </h1>
      </div>

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
              size="sm"
              onClick={() => toggleStatusFilter('pending')}
              className="text-[13px]"
            >
              Pending
            </Button>
            <Button
              variant={statusFilters.includes('booked') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStatusFilter('booked')}
              className="text-[13px]"
            >
              Booked
            </Button>
            <Button
              variant={statusFilters.includes('fulfilled') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStatusFilter('fulfilled')}
              className="text-[13px]"
            >
              Completed
            </Button>
            <Button
              variant={statusFilters.includes('cancelled') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStatusFilter('cancelled')}
              className="text-[13px]"
            >
              Cancelled
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 20 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No appointments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
