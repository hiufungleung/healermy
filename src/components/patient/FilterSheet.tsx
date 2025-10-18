'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/common/Button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilterSheetProps {
  // Filter options
  specialties: string[];
  serviceCategories: Array<{ id: string; name: string }>;
  serviceTypes: Record<string, string[]>;

  // Selected values
  selectedSpecialty: string;
  selectedServiceCategory: string;
  selectedServiceType: string;

  // Handlers
  onSpecialtyChange: (value: string) => void;
  onServiceCategoryChange: (value: string) => void;
  onServiceTypeChange: (value: string) => void;
  onClearAll: () => void;

  // Sheet state
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FilterSheet({
  specialties,
  serviceCategories,
  serviceTypes,
  selectedSpecialty,
  selectedServiceCategory,
  selectedServiceType,
  onSpecialtyChange,
  onServiceCategoryChange,
  onServiceTypeChange,
  onClearAll,
  open,
  onOpenChange,
}: FilterSheetProps) {
  // Count active filters
  const activeFilterCount = [
    selectedSpecialty,
    selectedServiceCategory,
    selectedServiceType,
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full relative">
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-primary rounded-full">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Filter Doctors</SheetTitle>
          <SheetDescription>
            Select your preferences to find the right doctor
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Specialty Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Specialty
              </h3>
              <RadioGroup value={selectedSpecialty} onValueChange={onSpecialtyChange}>
                <div className="space-y-3">
                  {specialties.map((specialty) => (
                    <div key={specialty} className="flex items-center space-x-3">
                      <RadioGroupItem
                        value={specialty}
                        id={`sheet-specialty-${specialty}`}
                      />
                      <Label
                        htmlFor={`sheet-specialty-${specialty}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {specialty}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Service Category Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Service Category
              </h3>
              <RadioGroup value={selectedServiceCategory} onValueChange={onServiceCategoryChange}>
                <div className="space-y-3">
                  {serviceCategories.map((category) => (
                    <div key={category.id} className="flex items-start space-x-3">
                      <RadioGroupItem
                        value={category.id}
                        id={`sheet-category-${category.id}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`sheet-category-${category.id}`}
                        className="text-sm font-normal cursor-pointer flex-1 leading-relaxed"
                      >
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Service Type Section */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Service Type
              </h3>
              <RadioGroup value={selectedServiceType} onValueChange={onServiceTypeChange}>
                <div className="space-y-3">
                  {Object.entries(serviceTypes).flatMap(([categoryId, types]) =>
                    types.map((type) => (
                      <div key={type} className="flex items-center space-x-3">
                        <RadioGroupItem
                          value={type}
                          id={`sheet-type-${type}`}
                        />
                        <Label
                          htmlFor={`sheet-type-${type}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {type}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="pt-4 border-t flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClearAll();
              onOpenChange?.(false);
            }}
            className="flex-1"
          >
            Clear All
          </Button>
          <Button
            onClick={() => onOpenChange?.(false)}
            className="flex-1"
          >
            Apply Filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
