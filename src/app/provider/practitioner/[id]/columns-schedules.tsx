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
import { formatDateForDisplay } from '@/library/timezone';
import type { Schedule } from '@/types/fhir';

export interface ScheduleRow extends Schedule {
  // Extended properties if needed
}

// Helper to format period (without year)
function formatPeriod(period: { start?: string; end?: string } | undefined): string {
  if (!period) return '-';

  // Format without year: MM/DD
  const formatWithoutYear = (date: string) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  const start = period.start ? formatWithoutYear(period.start) : '?';
  const end = period.end ? formatWithoutYear(period.end) : 'Ongoing';
  return `${start} - ${end}`;
}

// Helper to extract service category
function extractServiceCategory(schedule: Schedule): string {
  return schedule.serviceCategory?.[0]?.coding?.[0]?.display || '-';
}

// Helper to extract service type
function extractServiceType(schedule: Schedule): string {
  return schedule.serviceType?.[0]?.coding?.[0]?.display || '-';
}

// Helper to extract specialty
function extractSpecialty(schedule: Schedule): string {
  return schedule.specialty?.[0]?.coding?.[0]?.display || '-';
}

export const columns: ColumnDef<ScheduleRow>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Schedule ID
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-[13px] font-mono">{row.original.id || '-'}</div>,
    size: 120,
  },
  {
    accessorKey: 'active',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.original.active ? 'success' : 'danger'}
        className="capitalize text-[13px] font-normal"
      >
        {row.original.active ? 'Active' : 'Inactive'}
      </Badge>
    ),
    size: 100,
  },
  {
    accessorFn: (row) => formatPeriod(row.planningHorizon),
    id: 'planningHorizon',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Planning Horizon
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-[13px]">{formatPeriod(row.original.planningHorizon)}</div>
    ),
    size: 200,
  },
  {
    accessorFn: (row) => extractServiceCategory(row),
    id: 'serviceCategory',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Service Category
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-[13px]">{extractServiceCategory(row.original)}</div>
    ),
    size: 150,
  },
  {
    accessorFn: (row) => extractServiceType(row),
    id: 'serviceType',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Service Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-[13px]">{extractServiceType(row.original)}</div>
    ),
    size: 150,
  },
  {
    accessorFn: (row) => extractSpecialty(row),
    id: 'specialty',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="text-[13px] px-0 hover:bg-transparent"
      >
        Specialty
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-[13px]">{extractSpecialty(row.original)}</div>
    ),
    size: 150,
  },
  {
    id: 'actions',
    header: () => <div className="text-[13px]">Actions</div>,
    cell: ({ row, table }) => {
      const schedule = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-[13px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {schedule.active ? (
              <DropdownMenuItem
                onClick={() => {
                  // Trigger deactivate action
                  const event = new CustomEvent('schedule-action', {
                    detail: { action: 'deactivate', scheduleId: schedule.id }
                  });
                  window.dispatchEvent(event);
                }}
                className="text-orange-600"
              >
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  // Trigger activate action
                  const event = new CustomEvent('schedule-action', {
                    detail: { action: 'activate', scheduleId: schedule.id }
                  });
                  window.dispatchEvent(event);
                }}
                className="text-green-600"
              >
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Trigger generate slots action
                const event = new CustomEvent('schedule-action', {
                  detail: { action: 'generateSlots', scheduleId: schedule.id }
                });
                window.dispatchEvent(event);
              }}
            >
              Generate Slots
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // Trigger view slots action
                const event = new CustomEvent('schedule-action', {
                  detail: { action: 'viewSlots', scheduleId: schedule.id }
                });
                window.dispatchEvent(event);
              }}
            >
              View Slots
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Trigger clear slots action
                const event = new CustomEvent('schedule-action', {
                  detail: { action: 'clearSlots', scheduleId: schedule.id }
                });
                window.dispatchEvent(event);
              }}
              className="text-yellow-600"
            >
              Clear All Slots
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // Trigger delete schedule action
                const event = new CustomEvent('schedule-action', {
                  detail: { action: 'deleteSchedule', scheduleId: schedule.id }
                });
                window.dispatchEvent(event);
              }}
              className="text-red-600"
            >
              Delete Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 80,
  },
];
