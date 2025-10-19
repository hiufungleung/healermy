'use client';

import React from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatTimeForDisplay, formatSlotTime } from '@/library/timezone';
import type { Slot } from '@/types/fhir';

export interface SlotDisplayProps {
  slots: Slot[];
  mode: 'calendar' | 'grid' | 'list';
  onSlotClick?: (slot: Slot) => void;
  onSlotDelete?: (slotId: string) => void;
  selectedSlotId?: string;
  maxDisplaySlots?: number; // For calendar mode
  showDeleteButton?: boolean;
  className?: string;
  schedules?: any[]; // Array of Schedule objects for service-type lookup
}

export function SlotDisplay({
  slots,
  mode,
  onSlotClick,
  onSlotDelete,
  selectedSlotId,
  maxDisplaySlots = 3,
  showDeleteButton = false,
  className = '',
  schedules = []
}: SlotDisplayProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'free':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'busy':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'busy-unavailable':
        return 'bg-gray-500 hover:bg-gray-600 text-white';
      default:
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' => {
    switch (status) {
      case 'free':
        return 'success';
      case 'busy':
      case 'busy-unavailable':
        return 'danger';
      default:
        return 'warning';
    }
  };

  if (mode === 'calendar') {
    // Calendar mode: Compact display for calendar cells
    const displaySlots = slots.slice(0, maxDisplaySlots);
    const remainingCount = slots.length - maxDisplaySlots;

    return (
      <div className={`space-y-1 ${className}`}>
        {displaySlots.map(slot => (
          <div
            key={slot.id}
            className="group relative"
          >
            <div className={`
              text-xs px-1 py-0.5 rounded cursor-pointer relative
              ${getStatusColor(slot.status)}
            `}
            onClick={() => onSlotClick?.(slot)}
            >
              <div className="flex justify-between items-center">
                <span className="truncate">
                  {formatTimeForDisplay(slot.start)}
                </span>
                {showDeleteButton && slot.status === 'free' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotDelete?.(slot.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 text-white hover:text-red-200 transition-opacity"
                    title="Delete slot"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Tooltip for calendar mode */}
              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                ID: {slot.id}
                <br />
                {formatSlotTime(slot.start, slot.end)}
                <br />
                Status: {slot.status}
              </div>
            </div>
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div className="text-xs text-gray-500 px-1">
            +{remainingCount} more
          </div>
        )}
      </div>
    );
  }

  // Helper function to get service type from schedule (not from slot directly)
  const getServiceTypeFromSchedule = (slot: Slot) => {
    // Extract schedule ID from slot.schedule.reference (e.g., "Schedule/133109")
    const scheduleRef = slot.schedule?.reference;
    if (!scheduleRef || schedules.length === 0) {
      return { code: 'general', display: 'General' };
    }

    const scheduleId = scheduleRef.replace('Schedule/', '');
    const matchingSchedule = schedules.find((s: any) => s.id === scheduleId);

    if (matchingSchedule) {
      const code = matchingSchedule.serviceType?.[0]?.coding?.[0]?.code || 'general';
      const display = matchingSchedule.serviceType?.[0]?.coding?.[0]?.display || 'General';
      return { code, display };
    }

    return { code: 'general', display: 'General' };
  };

  // Helper function to get service type color (border color to identify service type)
  // Dynamically assigns colors based on unique service types found in schedules
  const getServiceTypeColor = (slot: Slot) => {
    const { code } = getServiceTypeFromSchedule(slot);

    // Dynamic color palette (same order as legend)
    const colorPalette = [
      'border-blue-500',
      'border-green-500',
      'border-red-500',
      'border-purple-500',
      'border-indigo-500',
      'border-yellow-500',
      'border-pink-500',
      'border-teal-500',
      'border-orange-500',
      'border-cyan-500',
    ];

    // Build a consistent mapping of service type codes to colors
    if (schedules.length === 0) {
      return 'border-gray-400';
    }

    // Get all unique service type codes from schedules
    const uniqueServiceTypes = Array.from(
      new Set(
        schedules
          .map((s: any) => s.serviceType?.[0]?.coding?.[0]?.code)
          .filter(Boolean)
      )
    );

    // Find the index of this service type
    const index = uniqueServiceTypes.indexOf(code);

    // Return color based on index, or grey if not found
    return index >= 0 ? colorPalette[index % colorPalette.length] : 'border-gray-400';
  };

  const getServiceTypeLabel = (slot: Slot): string => {
    const { display } = getServiceTypeFromSchedule(slot);
    return display;
  };

  if (mode === 'grid') {
    // Grid mode: For patient booking time selection with service type colors
    // Mobile: 4 columns, Tablet: 5 columns, Desktop: 6 columns for more compact display
    return (
      <div className={`grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 ${className}`}>
        {slots.map(slot => {
          const isSelected = selectedSlotId === slot.id;
          const isAvailable = slot.status === 'free';
          const serviceTypeColor = getServiceTypeColor(slot);
          const serviceTypeLabel = getServiceTypeLabel(slot);

          return (
            <Button
              key={slot.id}
              onClick={() => isAvailable && onSlotClick?.(slot)}
              disabled={!isAvailable}
              variant="outline"
              size="sm"
              className={`py-2 px-2 h-auto rounded-lg border-2 transition-all ${
                isSelected
                  ? 'bg-primary text-white border-primary hover:bg-primary hover:text-white'
                  : isAvailable
                  ? `bg-white hover:bg-gray-50 hover:shadow-md hover:text-inherit ${serviceTypeColor}`
                  : `bg-gray-100 text-gray-400 cursor-not-allowed opacity-50 ${serviceTypeColor}`
              }`}
            >
              <div className="text-sm font-medium">{formatTimeForDisplay(slot.start)}</div>
            </Button>
          );
        })}
      </div>
    );
  }

  if (mode === 'list') {
    // List mode: Detailed list view
    return (
      <div className={`space-y-2 ${className}`}>
        {slots.map(slot => (
          <div
            key={slot.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
            onClick={() => onSlotClick?.(slot)}
          >
            <div className="flex items-center space-x-3">
              <Badge variant={getStatusBadgeVariant(slot.status)}>
                {slot.status}
              </Badge>
              <div>
                <div className="font-medium">
                  {formatSlotTime(slot.start, slot.end)}
                </div>
                <div className="text-xs text-gray-400">
                  ID: {slot.id}
                </div>
                {slot.serviceType && slot.serviceType[0]?.coding?.[0]?.display && (
                  <div className="text-sm text-gray-500">
                    {slot.serviceType[0].coding[0].display}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {slot.status === 'free' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotClick?.(slot);
                  }}
                >
                  Select
                </Button>
              )}
              
              {showDeleteButton && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotDelete?.(slot.id);
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// Convenience wrapper for patient booking
export function SlotSelectionGrid({
  slots,
  selectedSlotId,
  onSlotSelect,
  className,
  schedules
}: {
  slots: Slot[];
  selectedSlotId?: string;
  onSlotSelect: (slot: Slot) => void;
  className?: string;
  schedules?: any[];
}) {
  return (
    <SlotDisplay
      slots={slots}
      mode="grid"
      selectedSlotId={selectedSlotId}
      onSlotClick={onSlotSelect}
      className={className}
      schedules={schedules}
    />
  );
}

// Convenience wrapper for provider calendar
export function SlotCalendarDisplay({
  slots,
  onSlotDelete,
  maxDisplay = 3,
  className
}: {
  slots: Slot[];
  onSlotDelete?: (slotId: string) => void;
  maxDisplay?: number;
  className?: string;
}) {
  return (
    <SlotDisplay
      slots={slots}
      mode="calendar"
      maxDisplaySlots={maxDisplay}
      onSlotDelete={onSlotDelete}
      showDeleteButton={!!onSlotDelete}
      className={className}
    />
  );
}

// Convenience wrapper for detailed slot management
export function SlotManagementList({
  slots,
  onSlotClick,
  onSlotDelete,
  className
}: {
  slots: Slot[];
  onSlotClick?: (slot: Slot) => void;
  onSlotDelete?: (slotId: string) => void;
  className?: string;
}) {
  return (
    <SlotDisplay
      slots={slots}
      mode="list"
      onSlotClick={onSlotClick}
      onSlotDelete={onSlotDelete}
      showDeleteButton={!!onSlotDelete}
      className={className}
    />
  );
}