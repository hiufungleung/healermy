'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/common/Card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/common/Badge';
import type { Slot, Schedule } from '@/types/fhir';

interface SlotFiltersProps {
  slots: Slot[];
  schedules: Schedule[];
  selectedSchedules: string[];
  selectedCategories: string[];
  selectedServiceTypes: string[];
  selectedSpecialties: string[];
  onSchedulesChange: (schedules: string[]) => void;
  onCategoriesChange: (categories: string[]) => void;
  onServiceTypesChange: (types: string[]) => void;
  onSpecialtiesChange: (specialties: string[]) => void;
}

export function SlotFilters({
  slots,
  schedules,
  selectedSchedules,
  selectedCategories,
  selectedServiceTypes,
  selectedSpecialties,
  onSchedulesChange,
  onCategoriesChange,
  onServiceTypesChange,
  onSpecialtiesChange,
}: SlotFiltersProps) {

  // Extract unique values from schedules for filtering
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const serviceTypes = new Set<string>();
    const specialties = new Set<string>();

    schedules.forEach(schedule => {
      // Extract service categories from schedule
      schedule.serviceCategory?.forEach(cat => {
        cat.coding?.forEach(code => {
          if (code.display) categories.add(code.display);
        });
      });

      // Extract service types from schedule
      schedule.serviceType?.forEach(type => {
        type.coding?.forEach(code => {
          if (code.display) serviceTypes.add(code.display);
        });
      });

      // Extract specialties from schedule
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

  const handleScheduleToggle = (scheduleId: string) => {
    if (selectedSchedules.includes(scheduleId)) {
      onSchedulesChange(selectedSchedules.filter(id => id !== scheduleId));
    } else {
      onSchedulesChange([...selectedSchedules, scheduleId]);
    }
  };

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
    onSchedulesChange([]);
    onCategoriesChange([]);
    onServiceTypesChange([]);
    onSpecialtiesChange([]);
  };

  const hasActiveFilters =
    selectedSchedules.length > 0 ||
    selectedCategories.length > 0 ||
    selectedServiceTypes.length > 0 ||
    selectedSpecialties.length > 0;

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
        {/* Schedule Filter */}
        <div>
          <Label className="text-xs md:text-sm font-medium mb-2 block">Schedule</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {schedules.map(schedule => (
              <div key={schedule.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`schedule-${schedule.id}`}
                  checked={selectedSchedules.includes(schedule.id!)}
                  onCheckedChange={() => handleScheduleToggle(schedule.id!)}
                />
                <label
                  htmlFor={`schedule-${schedule.id}`}
                  className="text-xs md:text-sm cursor-pointer truncate flex-1"
                  title={schedule.id}
                >
                  {schedule.id}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Service Category Filter */}
        {filterOptions.categories.length > 0 && (
          <div>
            <Label className="text-xs md:text-sm font-medium mb-2 block">Category</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filterOptions.categories.map(category => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => handleCategoryToggle(category)}
                  />
                  <label
                    htmlFor={`category-${category}`}
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
                    id={`service-${type}`}
                    checked={selectedServiceTypes.includes(type)}
                    onCheckedChange={() => handleServiceTypeToggle(type)}
                  />
                  <label
                    htmlFor={`service-${type}`}
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
                    id={`specialty-${specialty}`}
                    checked={selectedSpecialties.includes(specialty)}
                    onCheckedChange={() => handleSpecialtyToggle(specialty)}
                  />
                  <label
                    htmlFor={`specialty-${specialty}`}
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
              {selectedSchedules.length > 0 && (
                <div>Schedules: {selectedSchedules.length}</div>
              )}
              {selectedCategories.length > 0 && (
                <div>Categories: {selectedCategories.length}</div>
              )}
              {selectedServiceTypes.length > 0 && (
                <div>Service Types: {selectedServiceTypes.length}</div>
              )}
              {selectedSpecialties.length > 0 && (
                <div>Specialties: {selectedSpecialties.length}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
