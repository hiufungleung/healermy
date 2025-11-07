'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/common/Badge';
import { FancyLoader } from '@/components/common/FancyLoader';
import { formatAppointmentDateTime } from '@/library/timezone';
import { getAvailableActions, getActionLabel, executeAction } from '@/library/appointmentFlowUtils';
import type { Appointment, Encounter } from '@/types/fhir';

// Extended appointment type with patient and encounter details
export interface AppointmentRow extends Appointment {
  patientName?: string;
  practitionerName?: string;
  encounter?: Encounter;
}

// Context for passing updatingRows state to column cells
export interface ColumnsContext {
  updatingRows?: Set<string>;
  updatingActions?: Map<string, string>; // appointmentId -> action name
  onActionStart?: (appointmentId: string, action: string) => void;
  onActionEnd?: (appointmentId: string) => void;
}

// Options for column configuration
export interface ColumnsOptions {
  includeReason?: boolean; // Default true - set to false to exclude reason column
}

// Get status badge variant
function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'secondary' {
  switch (status) {
    case 'booked':
      return 'success';
    case 'fulfilled':
      return 'secondary'; // Grey for archived feeling
    case 'pending':
    case 'proposed':
      return 'warning';
    case 'cancelled':
    case 'noshow':
    case 'entered-in-error':
      return 'danger';
    case 'arrived':
    case 'checked-in':
    case 'waitlist':
      return 'info';
    default:
      return 'info';
  }
}

// Get encounter status badge variant
function getEncounterBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'secondary' {
  switch (status) {
    case 'finished':
      return 'secondary'; // Grey for archived feeling
    case 'planned':
    case 'on-hold':
      return 'warning';
    case 'cancelled':
    case 'discontinued':
    case 'entered-in-error':
      return 'danger';
    case 'in-progress':
      return 'info';
    default:
      return 'info';
  }
}

export const createColumns = (context?: ColumnsContext, options?: ColumnsOptions): ColumnDef<AppointmentRow>[] => {
  const includeReason = options?.includeReason !== false; // Default to true

  const allColumns: ColumnDef<AppointmentRow>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const appointmentId = row.original.id;
      if (!appointmentId) return <span className="text-gray-400 text-[13px]">-</span>;

      return (
        <div className="text-[13px] font-mono text-gray-600">
          {appointmentId}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: 'start',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const startTime = row.original.start;
      if (!startTime) return <span className="text-gray-400 text-[13px]">-</span>;

      return (
        <div className="text-[13px] whitespace-nowrap">
          {formatAppointmentDateTime(startTime, false)}
        </div>
      );
    },
    size: 140,
  },
  {
    accessorKey: 'patientName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Patient
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const patientName = row.original.patientName || 'Unknown Patient';
      return <div className="text-[13px]">{patientName}</div>;
    },
    size: 160,
  },
  {
    accessorKey: 'practitionerName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Practitioner
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const practitionerName = row.original.practitionerName || 'Unknown Practitioner';
      return <div className="text-[13px]">{practitionerName}</div>;
    },
    size: 160,
  },
  {
    accessorFn: (row) => {
      const reasonCode = row.reasonCode;
      const firstReason = reasonCode?.[0];
      return firstReason?.text || firstReason?.coding?.[0]?.display || '-';
    },
    id: 'reason',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Reason
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const reasonCode = row.original.reasonCode;
      const firstReason = reasonCode?.[0];
      const reason = firstReason?.text || firstReason?.coding?.[0]?.display || '-';
      return <div className="min-w-[150px] truncate text-[13px]" title={reason}>{reason}</div>;
    },
    size: 200,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Appointment
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.original.status;
      const appointmentId = row.original.id;
      const isUpdating = appointmentId && context?.updatingRows?.has(appointmentId);
      const currentAction = appointmentId ? context?.updatingActions?.get(appointmentId) : undefined;

      // Show spinner only for actions that change appointment status
      const showSpinner = isUpdating && currentAction && [
        'confirm', 'cancel', 'mark-arrived', 'complete-encounter'
      ].includes(currentAction);

      if (showSpinner) {
        return (
          <div className="flex items-center h-6 pl-6">
            <div className="w-6 h-6 flex items-center justify-center">
              <FancyLoader size="sm" className="scale-[0.4]" />
            </div>
          </div>
        );
      }

      return (
        <Badge variant={getStatusBadgeVariant(status)} className="capitalize text-[13px] font-normal">
          {status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorFn: (row) => row.encounter?.status || '',
    id: 'encounterStatus',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="text-[13px] px-0 hover:bg-transparent"
        >
          Encounter
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const encounter = row.original.encounter;
      const appointmentId = row.original.id;
      const isUpdating = appointmentId && context?.updatingRows?.has(appointmentId);
      const currentAction = appointmentId ? context?.updatingActions?.get(appointmentId) : undefined;

      // Show spinner only for actions that change encounter status
      const showSpinner = isUpdating && currentAction && [
        'start-in-10-min', 'start-encounter', 'complete-encounter'
      ].includes(currentAction);

      if (showSpinner) {
        return (
          <div className="flex items-center h-6 pl-6">
            <div className="w-6 h-6 flex items-center justify-center">
              <FancyLoader size="sm" className="scale-[0.4]" />
            </div>
          </div>
        );
      }

      // Show "-" if no encounter exists
      if (!encounter) {
        return <span className="text-gray-400 text-[13px]">-</span>;
      }

      // Show encounter status badge
      return (
        <Badge variant={getEncounterBadgeVariant(encounter.status)} className="capitalize text-[13px] font-normal">
          {encounter.status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const appointment = row.original;
      const actions = getAvailableActions(
        appointment.status,
        appointment.encounter?.status
      );

      const handleAction = async (action: string) => {
        const appointmentId = appointment.id!;

        // Handle "View Detail" action separately (no API call needed)
        if (action === 'view-detail') {
          window.dispatchEvent(new CustomEvent('view-appointment-detail', {
            detail: { appointment }
          }));
          return;
        }

        try {
          // Mark row as updating with action name
          context?.onActionStart?.(appointmentId, action);

          const result = await executeAction(
            action,
            appointmentId,
            appointment.encounter?.id
          );

          // Dispatch event with updated data from PATCH response
          window.dispatchEvent(new CustomEvent('refresh-appointments', {
            detail: {
              appointmentId: appointmentId,
              updatedAppointment: result.appointment,
              updatedEncounter: result.encounter
            }
          }));
        } catch (error) {
          console.error('Error executing action:', error);
          alert(`Failed to ${getActionLabel(action).toLowerCase()}. Please try again.`);
        } finally {
          // Mark row as no longer updating
          context?.onActionEnd?.(appointmentId);
        }
      };

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel className='text-[13px]'>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Always show "View Detail" first */}
            <DropdownMenuItem className='text-[13px]'
              onClick={() => handleAction('view-detail')}
            >
              View Detail
            </DropdownMenuItem>
            {/* Show other available actions */}
            {actions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {actions.map((action) => (
                  <DropdownMenuItem className='text-[13px]'
                    key={action}
                    onClick={() => handleAction(action)}
                  >
                    {getActionLabel(action)}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      );
    },
    size: 60,
  },
  ];

  // Filter out reason column if requested
  if (!includeReason) {
    return allColumns.filter(col => col.id !== 'reason');
  }

  return allColumns;
};

// Backward compatibility: export columns without context
export const columns = createColumns();
