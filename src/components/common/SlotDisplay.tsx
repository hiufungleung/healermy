'use client';

import React from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { formatTimeForDisplay, formatSlotTime } from '@/lib/timezone';
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
}

export function SlotDisplay({
  slots,
  mode,
  onSlotClick,
  onSlotDelete,
  selectedSlotId,
  maxDisplaySlots = 3,
  showDeleteButton = false,
  className = ''
}: SlotDisplayProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'free':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'busy':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
    }
  };

  const getStatusBadgeVariant = (status: string): 'success' | 'danger' | 'warning' => {
    switch (status) {
      case 'free':
        return 'success';
      case 'busy':
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

  if (mode === 'grid') {
    // Grid mode: For patient booking time selection
    return (
      <div className={`grid grid-cols-3 md:grid-cols-4 gap-2 ${className}`}>
        {slots.map(slot => {
          const isSelected = selectedSlotId === slot.id;
          const isAvailable = slot.status === 'free';

          return (
            <button
              key={slot.id}
              onClick={() => isAvailable && onSlotClick?.(slot)}
              disabled={!isAvailable}
              className={`py-3 px-4 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-primary text-white border-primary'
                  : isAvailable
                  ? 'bg-white hover:bg-gray-50 border-gray-200'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
            >
              <div>{formatTimeForDisplay(slot.start)}</div>
            </button>
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
  className
}: {
  slots: Slot[];
  selectedSlotId?: string;
  onSlotSelect: (slot: Slot) => void;
  className?: string;
}) {
  return (
    <SlotDisplay
      slots={slots}
      mode="grid"
      selectedSlotId={selectedSlotId}
      onSlotClick={onSlotSelect}
      className={className}
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