'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { FancyLoader } from '@/components/common/FancyLoader';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
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
import type { SessionData } from '@/types/auth';
import type { Practitioner, Appointment, Encounter, Patient } from '@/types/fhir';
import { getNowInAppTimezone } from '@/lib/timezone';
import { createColumns, AppointmentRow } from '@/app/provider/appointments/columns';

interface ProviderDashboardClientProps {
  provider: Practitioner | null;
  session: SessionData | null;
  providerName: string;
  greeting: string;
}

export default function ProviderDashboardClient({
  provider,
  session,
  providerName,
  greeting
}: ProviderDashboardClientProps) {
  const router = useRouter();

  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [todayScheduleAppointments, setTodayScheduleAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set());
  const [updatingActions, setUpdatingActions] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Listen for appointment refresh events from action executions
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      const { appointmentId, updatedAppointment, updatedEncounter } = event.detail;

      setTodayScheduleAppointments(prev => prev.map(row => {
        if (row.id === appointmentId) {
          return {
            ...row,
            ...updatedAppointment,
            encounter: updatedEncounter || row.encounter
          };
        }
        return row;
      }));
    };

    window.addEventListener('refresh-appointments' as any, handleRefresh);
    return () => window.removeEventListener('refresh-appointments' as any, handleRefresh);
  }, []);

  // Callbacks for action start/end
  const handleActionStart = (appointmentId: string, action: string) => {
    setUpdatingRows(prev => new Set(prev).add(appointmentId));
    setUpdatingActions(prev => new Map(prev).set(appointmentId, action));
  };

  const handleActionEnd = (appointmentId: string) => {
    setUpdatingRows(prev => {
      const updated = new Set(prev);
      updated.delete(appointmentId);
      return updated;
    });
    setUpdatingActions(prev => {
      const updated = new Map(prev);
      updated.delete(appointmentId);
      return updated;
    });
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = getNowInAppTimezone();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(today);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Calculate 10 minutes ago for fulfilled appointments filter
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // Fetch Today's Schedule appointments (booked/arrived + recent fulfilled) and pending in parallel
      const [bookedArrivedResponse, fulfilledResponse, pendingResponse] = await Promise.all([
        // Call 1: Booked and Arrived appointments for today
        fetch(`/api/fhir/Appointment?status=booked,arrived&slot.start=ge${today.toISOString()}&slot.start=lt${todayEnd.toISOString()}`, {
          credentials: 'include',
        }),
        // Call 2: Fulfilled appointments for today updated within last 10 minutes
        fetch(`/api/fhir/Appointment?status=fulfilled&slot.start=ge${today.toISOString()}&slot.start=lt${todayEnd.toISOString()}&_lastUpdated=ge${tenMinutesAgo.toISOString()}`, {
          credentials: 'include',
        }),
        // Call 3: Pending appointments (limit 10 for sidebar)
        fetch(`/api/fhir/Appointment?status=pending&_count=10`, {
          credentials: 'include',
        }),
      ]);

      // Process Today's Schedule appointments - extract from FHIR Bundle
      const bookedArrivedData = bookedArrivedResponse.ok ? await bookedArrivedResponse.json() : { entry: [] };
      const fulfilledData = fulfilledResponse.ok ? await fulfilledResponse.json() : { entry: [] };

      const bookedArrivedAppts: Appointment[] = bookedArrivedData.entry?.map((e: any) => e.resource) || [];
      const fulfilledAppts: Appointment[] = fulfilledData.entry?.map((e: any) => e.resource) || [];

      // Combine all appointments for Today's Schedule
      const allTodayAppts = [...bookedArrivedAppts, ...fulfilledAppts];

      // Extract patient IDs, practitioner IDs, and appointment IDs
      const patientIds = new Set<string>();
      const practitionerIds = new Set<string>();
      const appointmentIds = allTodayAppts.map(apt => apt.id).filter(Boolean);

      allTodayAppts.forEach(apt => {
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

      // Fetch encounters, patients, and practitioners in parallel
      const [encountersResponse, patientsResponse, practitionersResponse] = await Promise.all([
        appointmentIds.length > 0
          ? fetch(`/api/fhir/Encounter?appointment=${appointmentIds.join(',')}`, {
              credentials: 'include'
            })
          : null,
        patientIds.size > 0
          ? fetch(`/api/fhir/Patient?_id=${Array.from(patientIds).join(',')}`, {
              credentials: 'include'
            })
          : null,
        practitionerIds.size > 0
          ? fetch(`/api/fhir/Practitioner?_id=${Array.from(practitionerIds).join(',')}`, {
              credentials: 'include'
            })
          : null,
      ]);

      // Process encounters - extract from FHIR Bundle
      const encountersByAppointment = new Map<string, Encounter>();
      if (encountersResponse?.ok) {
        const encountersData = await encountersResponse.json();
        const encounters: Encounter[] = encountersData.entry?.map((e: any) => e.resource) || [];
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

      // Process patients - extract from FHIR Bundle
      const patientsMap = new Map<string, Patient>();
      if (patientsResponse?.ok) {
        const patientsData = await patientsResponse.json();
        const patients: Patient[] = patientsData.entry?.map((e: any) => e.resource) || [];
        patients.forEach(patient => {
          if (patient.id) {
            patientsMap.set(patient.id, patient);
          }
        });
      }

      // Process practitioners - extract from FHIR Bundle
      const practitionersMap = new Map<string, Practitioner>();
      if (practitionersResponse?.ok) {
        const practitionersData = await practitionersResponse.json();
        const practitioners: Practitioner[] = practitionersData.entry?.map((e: any) => e.resource) || [];
        practitioners.forEach(practitioner => {
          if (practitioner.id) {
            practitionersMap.set(practitioner.id, practitioner);
          }
        });
      }

      // Enhance appointments with patient names, practitioner names, and encounters
      const enhancedAppointments: AppointmentRow[] = allTodayAppts.map(apt => {
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
            patientName = name.text ||
              `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() ||
              `Patient ${patientId}`;
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
            const prefix = name.prefix?.[0] || '';
            practitionerName = name.text ||
              `${prefix} ${name.given?.join(' ') || ''} ${name.family || ''}`.trim() ||
              `Practitioner ${practitionerId}`;
          }
        }

        // Get encounter
        const encounter = apt.id ? encountersByAppointment.get(apt.id) : undefined;

        return {
          ...apt,
          patientName,
          practitionerName,
          encounter,
        };
      });

      setTodayScheduleAppointments(enhancedAppointments);

      // Process pending appointments for sidebar - extract from FHIR Bundle
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingAppts = pendingData.entry?.map((e: any) => e.resource) || [];
        setPendingAppointments(pendingAppts);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatientFromAppointment = (appointment: Appointment) => {
    const patientParticipant = appointment.participant?.find(p =>
      p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor?.display || 'Patient';
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-AU', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Create table with pagination
  const table = useReactTable({
    data: todayScheduleAppointments,
    columns: createColumns(
      {
        updatingRows,
        updatingActions,
        onActionStart: handleActionStart,
        onActionEnd: handleActionEnd,
      },
      {
        includeReason: false, // Exclude reason column from dashboard view
      }
    ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Today's Schedule - Data Table */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base sm:text-lg md:text-xl font-semibold">Today's Schedule</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/provider/appointments')}
              >
                View All
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <FancyLoader size="md" />
              </div>
            ) : todayScheduleAppointments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-text-secondary">No appointments scheduled for today</p>
              </div>
            ) : (
              <>
                {/* Data Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} style={{ width: header.getSize() }}>
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
                            colSpan={table.getAllColumns().length}
                            className="h-24 text-center"
                          >
                            No appointments found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {table.getPageCount()} ({todayScheduleAppointments.length} total)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Sidebar - Pending Appointments Only */}
        <div>
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Pending Appointments</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/provider/appointments?time=all&status=pending')}
              >
                View All
              </Button>
            </div>

            <div className="space-y-3">
              {pendingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 border rounded-lg bg-yellow-50 border-yellow-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">{getPatientFromAppointment(appointment)}</div>
                    <div className="text-xs text-text-secondary">
                      {appointment.status && `Status: ${appointment.status}`}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">
                    {appointment.start ? formatDateTime(appointment.start) : 'Time TBD'}
                  </p>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {appointment.description || appointment.reasonCode?.[0]?.text || 'No reason provided'}
                  </p>
                </div>
              ))}

              {pendingAppointments.length === 0 && !loading && (
                <div className="text-center py-4">
                  <p className="text-sm text-text-secondary">No pending appointments</p>
                </div>
              )}
            </div>

            {loading && (
              <div className="text-center py-4">
                <FancyLoader size="sm" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
