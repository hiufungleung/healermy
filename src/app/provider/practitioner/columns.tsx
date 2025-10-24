'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Practitioner } from '@/types/fhir';

export interface PractitionerRow extends Practitioner {
  displayName?: string;
  phoneNumber?: string;
  addressString?: string;
}

export interface ColumnsContext {
  onViewDetails?: (practitioner: Practitioner) => void;
  onManageSchedules?: (practitioner: Practitioner) => void;
  onDelete?: (practitioner: Practitioner) => void;
  onSort?: (columnId: string) => void;
  currentSort?: string;
}

export const createColumns = (context?: ColumnsContext): ColumnDef<PractitionerRow>[] => [
  {
    accessorKey: 'id',
    header: () => {
      const isAscending = context?.currentSort === '_id';
      const isDescending = context?.currentSort === '-_id';

      return (
        <Button
          variant="ghost"
          onClick={() => context?.onSort?.('_id')}
          className="text-[13px] px-0 hover:bg-transparent flex items-center"
        >
          Practitioner ID
          <div className="ml-1 inline-flex items-center">
            <ChevronUp className={`h-3 w-3 ${isAscending ? 'text-primary' : 'text-gray-400'}`} />
            <ChevronDown className={`h-3 w-3 ${isDescending ? 'text-primary' : 'text-gray-400'}`} />
          </div>
        </Button>
      );
    },
    cell: ({ row }) => {
      const id = row.original.id;
      if (!id) return <span className="text-gray-400 text-[13px]">-</span>;

      return (
        <div className="text-[13px] font-mono text-gray-600">
          {id}
        </div>
      );
    },
    size: 120,
  },
  {
    accessorKey: 'displayName',
    header: () => {
      const isAscending = context?.currentSort === 'given';
      const isDescending = context?.currentSort === '-given';

      return (
        <Button
          variant="ghost"
          onClick={() => context?.onSort?.('given')}
          className="text-[13px] px-0 hover:bg-transparent flex items-center"
        >
          Name
          <div className="ml-1 inline-flex items-center">
            <ChevronUp className={`h-3 w-3 ${isAscending ? 'text-primary' : 'text-gray-400'}`} />
            <ChevronDown className={`h-3 w-3 ${isDescending ? 'text-primary' : 'text-gray-400'}`} />
          </div>
        </Button>
      );
    },
    cell: ({ row }) => {
      const practitioner = row.original;
      const name = practitioner.name?.[0];
      const displayName = name?.text ||
        `${name?.prefix?.join(' ') || ''} ${name?.given?.join(' ') || ''} ${name?.family || ''}`.trim() ||
        'Unknown Practitioner';

      // Extract qualifications
      const qualifications = practitioner.qualification?.map(q =>
        q.code?.text || q.code?.coding?.[0]?.display
      ).filter(Boolean) || [];

      return (
        <div className="min-w-[160px]">
          <div className="text-[13px] font-medium">{displayName}</div>
          {qualifications.length > 0 && (
            <div className="text-[12px] text-primary">{qualifications.join(', ')}</div>
          )}
        </div>
      );
    },
    size: 160,
  },
  {
    accessorKey: 'phoneNumber',
    header: () => {
      const isAscending = context?.currentSort === 'telecom';
      const isDescending = context?.currentSort === '-telecom';

      return (
        <Button
          variant="ghost"
          onClick={() => context?.onSort?.('telecom')}
          className="text-[13px] px-0 hover:bg-transparent flex items-center"
        >
          Telephone
          <div className="ml-1 inline-flex items-center">
            <ChevronUp className={`h-3 w-3 ${isAscending ? 'text-primary' : 'text-gray-400'}`} />
            <ChevronDown className={`h-3 w-3 ${isDescending ? 'text-primary' : 'text-gray-400'}`} />
          </div>
        </Button>
      );
    },
    cell: ({ row }) => {
      const practitioner = row.original;
      const phone = practitioner.telecom?.find(t => t.system === 'phone')?.value;

      if (!phone) return <span className="text-gray-400 text-[13px]">-</span>;

      return <div className="text-[13px]">{phone}</div>;
    },
    size: 100,
  },
  {
    accessorKey: 'addressString',
    header: () => {
      const isAscending = context?.currentSort === 'address';
      const isDescending = context?.currentSort === '-address';

      return (
        <Button
          variant="ghost"
          onClick={() => context?.onSort?.('address')}
          className="text-[13px] px-0 hover:bg-transparent flex items-center"
        >
          Address
          <div className="ml-1 inline-flex items-center">
            <ChevronUp className={`h-3 w-3 ${isAscending ? 'text-primary' : 'text-gray-400'}`} />
            <ChevronDown className={`h-3 w-3 ${isDescending ? 'text-primary' : 'text-gray-400'}`} />
          </div>
        </Button>
      );
    },
    cell: ({ row }) => {
      const practitioner = row.original;
      const address = practitioner.address?.[0];
      const addressString = address ? [
        address.line?.join(', '),
        address.city,
        address.state,
        address.postalCode
      ].filter(Boolean).join(', ') : null;

      if (!addressString) return <span className="text-gray-400 text-[13px]">-</span>;

      return (
        <div className="min-w-[200px] text-[13px] truncate" title={addressString}>
          {addressString}
        </div>
      );
    },
    size: 200,
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const practitioner = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => context?.onViewDetails?.(practitioner)}
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => context?.onManageSchedules?.(practitioner)}
            >
              Manage Schedules
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => context?.onDelete?.(practitioner)}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    size: 60,
  },
];
