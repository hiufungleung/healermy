'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Search } from 'lucide-react';
import { columns, ScheduleRow } from './columns-schedules';
import { CreateScheduleForm } from '@/components/provider/CreateScheduleForm';
import { GenerateSlotsForm } from '@/components/provider/GenerateSlotsForm';
import type { Schedule } from '@/types/fhir';
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_TYPES_BY_CATEGORY,
  SPECIALTIES,
  SPECIALTY_LABELS,
  getAllSpecialties,
  type ServiceCategoryCode,
  type ServiceTypeCode,
  type SpecialtyCode,
} from '@/constants/fhir';

interface PractitionerSchedulesTabProps {
  practitionerId: string;
  onScheduleUpdate?: () => void;
}

export default function PractitionerSchedulesTab({ practitionerId, onScheduleUpdate }: PractitionerSchedulesTabProps) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Filter states - all single choice
  const [scheduleFilterValid, setScheduleFilterValid] = useState<'valid' | 'expired'>('valid');
  const [activeStatus, setActiveStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryCode | ''>('');
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceTypeCode | ''>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyCode | ''>('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [searchId, setSearchId] = useState(''); // Search input state
  const [activeSearchId, setActiveSearchId] = useState(''); // Active search filter

  // Available service types based on selected category
  const [availableServiceTypes, setAvailableServiceTypes] = useState<Array<{value: ServiceTypeCode, label: string}>>([]);

  // UI states
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showGenerateSlots, setShowGenerateSlots] = useState(false);
  const [selectedScheduleForSlots, setSelectedScheduleForSlots] = useState<string>('');
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [scheduleToClearSlots, setScheduleToClearSlots] = useState<string | null>(null);

  // Update available service types when service category changes (cascading filter)
  useEffect(() => {
    if (selectedCategory) {
      const serviceTypes = SERVICE_TYPES_BY_CATEGORY[selectedCategory as ServiceCategoryCode] || [];
      setAvailableServiceTypes(serviceTypes);

      // Reset service type if current selection is not available in new category
      if (selectedServiceType && !serviceTypes.find(type => type.value === selectedServiceType)) {
        setSelectedServiceType('');
      }
    } else {
      setAvailableServiceTypes([]);
      setSelectedServiceType('');
    }
  }, [selectedCategory, selectedServiceType]);
  const [deletingSchedules, setDeletingSchedules] = useState<Set<string>>(new Set());
  const [clearingScheduleSlots, setClearingScheduleSlots] = useState<Set<string>>(new Set());

  // Fetch schedules with filters
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('actor', `Practitioner/${practitionerId}`);

      // Add ID filter if active search
      if (activeSearchId) {
        params.append('_id', activeSearchId);
      }

      // Add date filter based on valid/expired selection
      const today = new Date().toISOString().split('T')[0];
      if (scheduleFilterValid === 'valid') {
        params.append('date', `ge${today}`);
      } else {
        params.append('date', `lt${today}`);
      }

      // Add active status filter
      if (activeStatus === 'active') {
        params.append('active', 'true');
      } else if (activeStatus === 'inactive') {
        params.append('active', 'false');
      }
      // If 'all', don't add active parameter

      // Add service category filter
      if (selectedCategory) {
        params.append('service-category', selectedCategory);
      }

      // Add service type filter
      if (selectedServiceType) {
        params.append('service-type', selectedServiceType);
      }

      // Add specialty filter
      if (selectedSpecialty) {
        params.append('specialty', selectedSpecialty);
      }

      // Add custom date range filters (in addition to valid/expired)
      if (dateRange.from) {
        const startDateStr = dateRange.from.toISOString().split('T')[0];
        params.append('date', `ge${startDateStr}`);
      }
      if (dateRange.to) {
        const endDateStr = dateRange.to.toISOString().split('T')[0];
        params.append('date', `le${endDateStr}`);
      }

      console.log('[SCHEDULES] Fetching with filters:', params.toString());

      const response = await fetch(`/api/fhir/schedules?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schedules: ${response.status}`);
      }

      const result = await response.json();
      const fetchedSchedules: Schedule[] = result.schedules || [];

      console.log('[SCHEDULES] Fetched', fetchedSchedules.length, 'schedules');

      // Sort by newest first (by planning horizon start date)
      const sorted = [...fetchedSchedules].sort((a, b) => {
        const dateA = a.planningHorizon?.start || '';
        const dateB = b.planningHorizon?.start || '';
        return dateB.localeCompare(dateA);
      });

      setSchedules(sorted);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [practitionerId, scheduleFilterValid, activeStatus, selectedCategory, selectedServiceType, selectedSpecialty, dateRange, activeSearchId]);  // All filters trigger API refetch

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Handle schedule actions from dropdown menu
  useEffect(() => {
    const handleScheduleAction = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, scheduleId } = customEvent.detail;

      switch (action) {
        case 'activate':
          handleActivateSchedule(scheduleId);
          break;
        case 'deactivate':
          handleDeactivateSchedule(scheduleId);
          break;
        case 'generateSlots':
          setSelectedScheduleForSlots(scheduleId);
          setShowGenerateSlots(true);
          break;
        case 'viewSlots':
          // Navigate to slots tab with schedule filter
          window.location.href = `/provider/practitioner/${practitionerId}?tab=slots&schedule=${scheduleId}`;
          break;
        case 'clearSlots':
          setScheduleToClearSlots(scheduleId);
          break;
        case 'deleteSchedule':
          setScheduleToDelete(scheduleId);
          break;
      }
    };

    window.addEventListener('schedule-action', handleScheduleAction);
    return () => window.removeEventListener('schedule-action', handleScheduleAction);
  }, [practitionerId]);

  // Activate schedule
  const handleActivateSchedule = async (scheduleId: string) => {
    try {
      // Try 'replace' operation first
      let response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/active', value: true }
        ]),
      });

      // If replace fails (e.g., path doesn't exist), try 'add' operation
      if (!response.ok) {
        console.warn('[SCHEDULES] Replace failed, trying add operation for schedule:', scheduleId);
        response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'add', path: '/active', value: true }
          ]),
        });
      }

      if (response.ok) {
        console.log('[SCHEDULES] Activated schedule:', scheduleId);
        // Update local state
        setSchedules(prev => prev.map(s =>
          s.id === scheduleId ? { ...s, active: true } : s
        ));
        if (onScheduleUpdate) onScheduleUpdate();
      } else {
        const errorText = await response.text();
        console.error('[SCHEDULES] Failed to activate schedule:', response.status, errorText);
        throw new Error(`Failed to activate schedule: ${response.status}`);
      }
    } catch (error) {
      console.error('[SCHEDULES] Error activating schedule:', error);
      alert('Failed to activate schedule. Please try again.');
    }
  };

  // Deactivate schedule
  const handleDeactivateSchedule = async (scheduleId: string) => {
    try {
      // Try 'replace' operation first
      let response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([
          { op: 'replace', path: '/active', value: false }
        ]),
      });

      // If replace fails (e.g., path doesn't exist), try 'add' operation
      if (!response.ok) {
        console.warn('[SCHEDULES] Replace failed, trying add operation for schedule:', scheduleId);
        response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json-patch+json' },
          credentials: 'include',
          body: JSON.stringify([
            { op: 'add', path: '/active', value: false }
          ]),
        });
      }

      if (response.ok) {
        console.log('[SCHEDULES] Deactivated schedule:', scheduleId);
        // Update local state
        setSchedules(prev => prev.map(s =>
          s.id === scheduleId ? { ...s, active: false } : s
        ));
        if (onScheduleUpdate) onScheduleUpdate();
      } else {
        const errorText = await response.text();
        console.error('[SCHEDULES] Failed to deactivate schedule:', response.status, errorText);
        throw new Error(`Failed to deactivate schedule: ${response.status}`);
      }
    } catch (error) {
      console.error('[SCHEDULES] Error deactivating schedule:', error);
      alert('Failed to deactivate schedule. Please try again.');
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    setDeletingSchedules(prev => new Set([...prev, scheduleId]));

    try {
      const response = await fetch(`/api/fhir/schedules/${scheduleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        if (onScheduleUpdate) onScheduleUpdate();
      } else {
        console.error('Failed to delete schedule:', response.status);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    } finally {
      setDeletingSchedules(prev => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
      setScheduleToDelete(null);
    }
  };

  // Clear all slots for a schedule
  const handleClearScheduleSlots = async (scheduleId: string) => {
    setClearingScheduleSlots(prev => new Set([...prev, scheduleId]));

    try {
      // Fetch all slots for this schedule
      const response = await fetch(
        `/api/fhir/slots?schedule=Schedule/${scheduleId}&status=free`,
        { credentials: 'include' }
      );

      if (!response.ok) throw new Error('Failed to fetch slots');

      const { slots } = await response.json();

      // Delete each slot
      const deletePromises = slots.map((slot: any) =>
        fetch(`/api/fhir/slots/${slot.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      );

      await Promise.all(deletePromises);

      if (onScheduleUpdate) onScheduleUpdate();
    } catch (error) {
      console.error('Error clearing schedule slots:', error);
    } finally {
      setClearingScheduleSlots(prev => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
      setScheduleToClearSlots(null);
    }
  };

  // Initialize table (server-side filtering via FHIR API)
  const table = useReactTable({
    data: schedules,
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

  // Handle search by ID
  const handleSearch = () => {
    setActiveSearchId(searchId.trim());
  };

  // Handle Enter key in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchId('');
    setActiveSearchId('');
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveStatus('all');
    setSelectedCategory('');
    setSelectedServiceType('');
    setSelectedSpecialty('');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters =
    activeStatus !== 'all' ||
    selectedCategory !== '' ||
    selectedServiceType !== '' ||
    selectedSpecialty !== '' ||
    dateRange.from !== undefined ||
    dateRange.to !== undefined;

  return (
    <div className="w-full">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Schedules</h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage practitioner schedules and time slots
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateSchedule(true)}
          className="flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Schedule
        </Button>
      </div>

      {/* Filters Above Table */}
      <div className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Specialty Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Specialty</label>
            <Select
              value={selectedSpecialty || 'all'}
              onValueChange={(value) => setSelectedSpecialty(value === 'all' ? '' : value as SpecialtyCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {getAllSpecialties().map(specialty => (
                  <SelectItem key={specialty.value} value={specialty.value}>
                    {specialty.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Category Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Service Category</label>
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(value) => setSelectedCategory(value === 'all' ? '' : value as ServiceCategoryCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(SERVICE_CATEGORY_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Type Filter (cascades from category) */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Service Type</label>
            <Select
              value={selectedServiceType || 'all'}
              onValueChange={(value) => setSelectedServiceType(value === 'all' ? '' : value as ServiceTypeCode)}
              disabled={!selectedCategory}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={selectedCategory ? "All Types" : "Select category first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableServiceTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Status Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Date Status</label>
            <Select value={scheduleFilterValid} onValueChange={(value) => setScheduleFilterValid(value as 'valid' | 'expired')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select date status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valid">Not Expired</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Status Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Active Status</label>
            <Select value={activeStatus} onValueChange={(value) => setActiveStatus(value as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              placeholder="Select date range"
            />
          </div>
        </div>

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>

      {/* Search by ID */}
      <div className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Filter by schedule ID..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="text-[13px] max-w-xs"
          />
          <Button
            onClick={handleSearch}
            disabled={!searchId.trim()}
            className="text-[13px]"
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          {activeSearchId && (
            <Button
              variant="outline"
              onClick={handleClearSearch}
              className="text-[13px]"
            >
              Clear
            </Button>
          )}
        </div>
        {activeSearchId && (
          <p className="text-[13px] text-gray-600 mt-2">
            Filtering by ID: <span className="font-mono font-medium">{activeSearchId}</span>
          </p>
        )}
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
                {Array.from({ length: 5 }).map((_, index) => (
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
                    No schedules found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Schedule Form */}
      <CreateScheduleForm
        isOpen={showCreateSchedule}
        onClose={() => setShowCreateSchedule(false)}
        onSuccess={() => {
          fetchSchedules();
          if (onScheduleUpdate) onScheduleUpdate();
        }}
        practitionerId={practitionerId}
      />

      {/* Generate Slots Form */}
      <GenerateSlotsForm
        schedules={schedules}
        isOpen={showGenerateSlots}
        onClose={() => {
          setShowGenerateSlots(false);
          setSelectedScheduleForSlots('');
        }}
        onSuccess={() => {
          if (onScheduleUpdate) onScheduleUpdate();
        }}
        preSelectedScheduleId={selectedScheduleForSlots}
      />

      {/* Delete Schedule Confirmation */}
      <AlertDialog open={!!scheduleToDelete} onOpenChange={() => setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this schedule and all associated free slots. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scheduleToDelete && handleDeleteSchedule(scheduleToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Slots Confirmation */}
      <AlertDialog open={!!scheduleToClearSlots} onOpenChange={() => setScheduleToClearSlots(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Slots?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all free slots for this schedule. Booked slots will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scheduleToClearSlots && handleClearScheduleSlots(scheduleToClearSlots)}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Clear Slots
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
