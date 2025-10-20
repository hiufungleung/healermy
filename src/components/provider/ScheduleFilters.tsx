'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/library/shadcn-utils';
import type { Schedule } from '@/types/fhir';
import type { DateRange } from 'react-day-picker';

interface ScheduleFiltersProps {
  schedules: Schedule[];
  selectedCategories: string[];
  selectedServiceTypes: string[];
  selectedSpecialties: string[];
  startDate?: string;
  endDate?: string;
  onCategoriesChange: (categories: string[]) => void;
  onServiceTypesChange: (types: string[]) => void;
  onSpecialtiesChange: (specialties: string[]) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function ScheduleFilters({
  schedules,
  selectedCategories,
  selectedServiceTypes,
  selectedSpecialties,
  startDate,
  endDate,
  onCategoriesChange,
  onServiceTypesChange,
  onSpecialtiesChange,
  onStartDateChange,
  onEndDateChange,
}: ScheduleFiltersProps) {

  // Convert string dates to Date objects for Calendar
  const dateRange: DateRange | undefined = useMemo(() => {
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    return from || to ? { from, to } : undefined;
  }, [startDate, endDate]);

  // Handle date range selection from Calendar
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      onStartDateChange(format(range.from, 'yyyy-MM-dd'));
    } else {
      onStartDateChange('');
    }

    if (range?.to) {
      onEndDateChange(format(range.to, 'yyyy-MM-dd'));
    } else {
      onEndDateChange('');
    }
  };

  // Extract unique values from schedules for filtering
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const serviceTypes = new Set<string>();
    const specialties = new Set<string>();

    schedules.forEach(schedule => {
      // Extract service categories
      schedule.serviceCategory?.forEach(cat => {
        cat.coding?.forEach(code => {
          if (code.display) categories.add(code.display);
        });
      });

      // Extract service types
      schedule.serviceType?.forEach(type => {
        type.coding?.forEach(code => {
          if (code.display) serviceTypes.add(code.display);
        });
      });

      // Extract specialties
      schedule.specialty?.forEach(spec => {
        spec.coding?.forEach(code => {
          if (code.display) specialties.add(code.display);
        });
      });
    });

    return {
      categories: Array.from(categories).sort(),
      serviceTypes: Array.from(serviceTypes).sort(),
      specialties: Array.from(specialties).sort(),
    };
  }, [schedules]);

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoriesChange(selectedCategories.filter(c => c !== category));
    } else {
      onCategoriesChange([...selectedCategories, category]);
    }
  };

  const handleServiceTypeToggle = (type: string) => {
    if (selectedServiceTypes.includes(type)) {
      onServiceTypesChange(selectedServiceTypes.filter(t => t !== type));
    } else {
      onServiceTypesChange([...selectedServiceTypes, type]);
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    if (selectedSpecialties.includes(specialty)) {
      onSpecialtiesChange(selectedSpecialties.filter(s => s !== specialty));
    } else {
      onSpecialtiesChange([...selectedSpecialties, specialty]);
    }
  };

  const clearAllFilters = () => {
    onCategoriesChange([]);
    onServiceTypesChange([]);
    onSpecialtiesChange([]);
    onStartDateChange('');
    onEndDateChange('');
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedServiceTypes.length > 0 ||
    selectedSpecialties.length > 0 ||
    startDate ||
    endDate;

  return (
    <Card className="p-3 md:p-4 h-fit sticky top-20">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-sm md:text-base font-semibold">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-primary hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4 md:space-y-6">
        {/* Date Range Filter with Calendar */}
        <div>
          <Label className="text-xs md:text-sm font-medium mb-2 block">Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal text-xs md:text-sm h-9",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} -{" "}
                      {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={1}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Service Category Filter */}
        {filterOptions.categories.length > 0 && (
          <div>
            <Label className="text-xs md:text-sm font-medium mb-2 block">Category</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.categories.map(category => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sched-category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => handleCategoryToggle(category)}
                  />
                  <label
                    htmlFor={`sched-category-${category}`}
                    className="text-xs md:text-sm cursor-pointer truncate flex-1"
                    title={category}
                  >
                    {category}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Service Type Filter */}
        {filterOptions.serviceTypes.length > 0 && (
          <div>
            <Label className="text-xs md:text-sm font-medium mb-2 block">Service Type</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.serviceTypes.map(type => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sched-service-${type}`}
                    checked={selectedServiceTypes.includes(type)}
                    onCheckedChange={() => handleServiceTypeToggle(type)}
                  />
                  <label
                    htmlFor={`sched-service-${type}`}
                    className="text-xs md:text-sm cursor-pointer truncate flex-1"
                    title={type}
                  >
                    {type}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specialty Filter */}
        {filterOptions.specialties.length > 0 && (
          <div>
            <Label className="text-xs md:text-sm font-medium mb-2 block">Specialty</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.specialties.map(specialty => (
                <div key={specialty} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sched-specialty-${specialty}`}
                    checked={selectedSpecialties.includes(specialty)}
                    onCheckedChange={() => handleSpecialtyToggle(specialty)}
                  />
                  <label
                    htmlFor={`sched-specialty-${specialty}`}
                    className="text-xs md:text-sm cursor-pointer truncate flex-1"
                    title={specialty}
                  >
                    {specialty}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="pt-3 border-t">
            <div className="text-xs text-gray-600 mb-2">Active Filters:</div>
            <div className="text-xs font-medium">
              {selectedCategories.length > 0 && (
                <div>Categories: {selectedCategories.length}</div>
              )}
              {selectedServiceTypes.length > 0 && (
                <div>Service Types: {selectedServiceTypes.length}</div>
              )}
              {selectedSpecialties.length > 0 && (
                <div>Specialties: {selectedSpecialties.length}</div>
              )}
              {(startDate || endDate) && (
                <div>Date Range: Yes</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
