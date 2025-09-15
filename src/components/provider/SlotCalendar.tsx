'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { SlotCalendarDisplay } from '@/components/common/SlotDisplay';
import { formatTimeForDisplay, formatDateForDisplay } from '@/lib/timezone';
import type { Slot } from '@/types/fhir';

interface SlotCalendarProps {
  slots: Slot[];
  onDeleteSlot: (slotId: string) => void;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  slots: Slot[];
  isToday: boolean;
  isCurrentMonth: boolean;
}

export function SlotCalendar({ slots, onDeleteSlot }: SlotCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Get the first day of the current month
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Get the first day of the calendar (might be from previous month)
  const firstCalendarDay = new Date(firstDayOfMonth);
  firstCalendarDay.setDate(firstCalendarDay.getDate() - firstDayOfMonth.getDay());
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Group slots by date (using UTC date portion for simplicity)
    const slotsByDate = slots.reduce((acc, slot) => {
      // Extract just the date portion from the ISO string
      const dateStr = slot.start.split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(slot);
      return acc;
    }, {} as Record<string, Slot[]>);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(firstCalendarDay);
      date.setDate(firstCalendarDay.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const daySlots = slotsByDate[dateStr] || [];
      
      days.push({
        date: new Date(date),
        dateStr,
        slots: daySlots,
        isToday: date.getTime() === today.getTime(),
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
      });
    }
    
    return days;
  }, [slots, currentDate, firstCalendarDay]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };


  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Free ({slots.filter(s => s.status === 'free').length})</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Busy ({slots.filter(s => s.status === 'busy').length})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-px mb-2">
            {dayNames.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-text-secondary bg-gray-50">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`
                  min-h-[120px] p-2 bg-white relative
                  ${day.isCurrentMonth ? '' : 'bg-gray-50'}
                  ${day.isToday ? 'ring-2 ring-primary ring-inset' : ''}
                `}
              >
                {/* Date Number */}
                <div className={`
                  text-sm font-medium mb-1
                  ${day.isCurrentMonth ? 'text-text-primary' : 'text-text-secondary'}
                  ${day.isToday ? 'text-primary font-bold' : ''}
                `}>
                  {day.date.getDate()}
                </div>
                
                {/* Slots for this day */}
                <SlotCalendarDisplay
                  slots={day.slots}
                  onSlotDelete={onDeleteSlot}
                  maxDisplay={3}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}