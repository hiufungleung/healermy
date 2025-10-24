'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Layout } from '@/components/common/Layout';
import { Button } from '@/components/common/Button';
import { Skeleton } from '@/components/common/ContentSkeleton';
import { PractitionerSearch } from '@/components/common/PractitionerSearch';
import { CreatePractitionerForm } from '@/components/provider/CreatePractitionerForm';
import { ViewPractitionerDetails } from '@/components/provider/ViewPractitionerDetails';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import type { Practitioner } from '@/types/fhir';
import { createColumns, type PractitionerRow } from './columns';

// Table skeleton component - 50 rows
function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="w-[250px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[140px]">
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead className="w-[300px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 50 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function PractitionerManagement() {
  const router = useRouter();
  const [searchFilters, setSearchFilters] = useState({
    givenName: '',
    familyName: '',
    phone: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    addressCountry: '',
    practitionerId: ''
  });

  // Current page data
  const [practitioners, setPractitioners] = useState<PractitionerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting state - stores FHIR _sort parameter (e.g., "-given" for descending by given name)
  const [sortParam, setSortParam] = useState<string>('');

  // Ref to track previous state to prevent duplicate fetches in React StrictMode
  const prevFiltersRef = useRef<{ filters: typeof searchFilters; sort: string } | null>(null);

  // Pagination state - uses FHIR link URLs
  const [paginationLinks, setPaginationLinks] = useState<{
    self: string | null;
    next: string | null;
    previous: string | null;
  }>({ self: null, next: null, previous: null });

  // Modals
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [showViewDetails, setShowViewDetails] = useState(false);
  const [practitionerToDelete, setPractitionerToDelete] = useState<Practitioner | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch practitioners - supports both initial search and pagination via link URLs
  const fetchPractitioners = useCallback(async (linkUrl?: string, filters = searchFilters, sort = sortParam) => {
    setLoading(true);

    try {
      let apiUrl: string;

      if (linkUrl) {
        // PAGINATION: Use the link URL from FHIR response
        console.log('[Pagination] Using link URL:', linkUrl);
        const url = new URL(linkUrl);
        apiUrl = `/api/fhir/data?${url.searchParams.toString()}`;
      } else {
        // SEARCH: Build URL with filters
        console.log('[Search] Building search URL with filters:', filters, 'sort:', sort);
        const params = new URLSearchParams();
        params.append('_count', '50');

        // Add sorting parameter if provided
        if (sort) {
          params.append('_sort', sort);
        }

        // Add FHIR-compliant search parameters
        if (filters.givenName) {
          params.append('given:contains', filters.givenName);
        }
        if (filters.familyName) {
          params.append('family:contains', filters.familyName);
        }
        if (filters.phone) {
          params.append('phone:contains', filters.phone);
        }
        if (filters.addressCity) {
          params.append('address-city:contains', filters.addressCity);
        }
        if (filters.addressState) {
          params.append('address-state:contains', filters.addressState);
        }
        if (filters.addressPostalCode) {
          params.append('address-postalcode:contains', filters.addressPostalCode);
        }
        if (filters.addressCountry) {
          params.append('address-country:contains', filters.addressCountry);
        }
        if (filters.practitionerId) {
          params.append('_id', filters.practitionerId);
        }

        apiUrl = `/api/fhir/practitioners?${params.toString()}`;
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Authentication required, middleware will redirect');
          return;
        }
        throw new Error(`Failed to fetch practitioners: ${response.status}`);
      }

      const result = await response.json();
      console.log('[Fetch] Result:', {
        count: result.practitioners?.length || result.entry?.length,
        total: result.total,
        hasNext: !!result.links?.next
      });

      // Handle both API response formats (/practitioners vs /data)
      const practitioners = result.practitioners || result.entry?.map((e: any) => e.resource) || [];
      const links = result.links || {
        self: result.link?.find((l: any) => l.relation === 'self')?.url || null,
        next: result.link?.find((l: any) => l.relation === 'next')?.url || null,
        previous: result.link?.find((l: any) => l.relation === 'previous')?.url || null,
      };

      setPractitioners(practitioners);
      setPaginationLinks(links);
      setTotalCount(result.total || 0);
      setLoading(false);

      // STAGE 2: Fetch total count if there's more data (next link exists)
      // Only do this on initial search, not on pagination
      if (!linkUrl && links.next) {
        console.log('[Total Count] Fetching total count by jumping to end...');

        // IMPORTANT: Use the 'next' link from FIRST API response
        // This preserves the _getpages session ID and all search params from the first API
        const nextUrl = new URL(links.next);
        const params = new URLSearchParams(nextUrl.searchParams);

        // Set offset to very large number to jump to the end
        // The last page will have no entries but will include the total count
        params.set('_getpagesoffset', '1000000');

        console.log('[Total Count] Fetching with offset=1000000 to get total:', params.toString());

        const totalResponse = await fetch(`/api/fhir/data?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (totalResponse.ok) {
          const totalResult = await totalResponse.json();
          console.log('[Total Count] Received total:', totalResult.total);
          // Only update total count, don't update practitioners (we already have first page rendered)
          setTotalCount(totalResult.total || 0);
        }
      }

    } catch (error) {
      console.error('Error fetching practitioners:', error);
      setPractitioners([]);
      setPaginationLinks({ self: null, next: null, previous: null });
      setTotalCount(0);
      setLoading(false);
    }
  }, []); // No dependencies - function is stable

  // Load practitioners when search filters or sort changes
  useEffect(() => {
    // Check if filters or sort actually changed (prevents duplicate calls in React StrictMode)
    const currentState = { filters: searchFilters, sort: sortParam };
    if (prevFiltersRef.current &&
        JSON.stringify(prevFiltersRef.current) === JSON.stringify(currentState)) {
      return; // State hasn't changed, skip fetch
    }

    prevFiltersRef.current = currentState;
    fetchPractitioners(undefined, searchFilters, sortParam);
  }, [searchFilters, sortParam, fetchPractitioners]); // Refetch when filters or sort changes

  // Handle search filter changes
  const handleFiltersChange = useCallback((filters: typeof searchFilters) => {
    setSearchFilters(filters);
  }, []);

  // Handle column sort - triggers API call with _sort parameter
  const handleSort = useCallback((columnId: string) => {
    // Toggle between ascending, descending, and no sort
    setSortParam((current) => {
      if (current === columnId) {
        // Currently ascending → switch to descending
        return `-${columnId}`;
      } else if (current === `-${columnId}`) {
        // Currently descending → remove sort
        return '';
      } else {
        // No sort or different column → set to ascending
        return columnId;
      }
    });
  }, []);

  // Pagination handlers
  const handlePreviousPage = () => {
    if (paginationLinks.previous && !loading) {
      fetchPractitioners(paginationLinks.previous);
    }
  };

  const handleNextPage = () => {
    if (paginationLinks.next && !loading) {
      fetchPractitioners(paginationLinks.next);
    }
  };

  const handleGoToPage = (pageNumber: number) => {
    if (loading || pageNumber === currentPage) return;

    // Construct URL with correct offset
    // Page 1 = offset 0, Page 2 = offset 50, Page 3 = offset 100, etc.
    const offset = (pageNumber - 1) * 50;

    // Use the next link as template (has all pagination params like _getpages)
    // Fall back to self or previous if next is not available
    const templateLink = paginationLinks.next || paginationLinks.previous || paginationLinks.self;
    if (!templateLink) return;

    try {
      const url = new URL(templateLink);
      url.searchParams.set('_getpagesoffset', offset.toString());
      fetchPractitioners(url.toString());
    } catch (error) {
      console.error('Error constructing page URL:', error);
    }
  };

  // Calculate current page number from offset
  const currentPage = (() => {
    if (paginationLinks.self) {
      try {
        const url = new URL(paginationLinks.self);
        const offset = parseInt(url.searchParams.get('_getpagesoffset') || '0');
        return Math.floor(offset / 50) + 1;
      } catch {
        return 1;
      }
    }
    return 1;
  })();

  const totalPages = Math.ceil(totalCount / 50);

  // Action handlers
  const handleViewDetails = useCallback((practitioner: Practitioner) => {
    setSelectedPractitioner(practitioner);
    setShowViewDetails(true);
  }, []);

  const handleManageSchedules = useCallback((practitioner: Practitioner) => {
    router.push(`/provider/practitioner/${practitioner.id}`);
  }, [router]);

  const handleDeleteClick = useCallback((practitioner: Practitioner) => {
    setPractitionerToDelete(practitioner);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!practitionerToDelete?.id) return;

    try {
      const response = await fetch(`/api/fhir/practitioners/${practitionerToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete practitioner: ${response.status}`);
      }

      console.log('Practitioner deleted successfully');

      // Refresh the list
      fetchPractitioners();

    } catch (error) {
      console.error('Error deleting practitioner:', error);
      alert('Failed to delete practitioner. Please try again.');
    } finally {
      setShowDeleteDialog(false);
      setPractitionerToDelete(null);
    }
  };

  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = () => {
    fetchPractitioners();
  };

  // Handle row click to navigate to practitioner detail page
  const handleRowClick = useCallback((practitionerId: string) => {
    router.push(`/provider/practitioner/${practitionerId}`);
  }, [router]);

  // Create columns with context handlers
  const columns = createColumns({
    onViewDetails: handleViewDetails,
    onManageSchedules: handleManageSchedules,
    onDelete: handleDeleteClick,
    onSort: handleSort,
    currentSort: sortParam,
  });

  // Initialize react-table (no sorting state - using server-side sorting)
  const table = useReactTable({
    data: practitioners,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true, // Disable client-side sorting
  });

  return (
    <Layout>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">
              Practitioner
            </h1>
          </div>
        </div>

        {/* Practitioner Search Component */}
        <PractitionerSearch
          onFiltersChange={handleFiltersChange}
          loading={loading}
          showAdvancedFilters={true}
          showOracleIdField={true}
        />

        {/* Data Table */}
        {loading ? (
          <TableSkeleton />
        ) : practitioners.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} style={{ width: header.getSize() }}>
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={() => handleRowClick(row.original.id!)}
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls - show if there are navigation links OR multiple pages */}
            {(paginationLinks.next || paginationLinks.previous || totalPages > 1) && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    {/* Previous Button */}
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => {
                          e.preventDefault();
                          if (paginationLinks.previous && !loading) {
                            handlePreviousPage();
                          }
                        }}
                        className={
                          !paginationLinks.previous || loading
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>

                    {/* Page Number Buttons */}
                    {(() => {
                      const pages: (number | 'ellipsis')[] = [];
                      const maxVisible = 7; // Maximum visible page buttons

                      if (totalPages <= maxVisible) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Smart pagination: show first, last, current, and neighbors
                        pages.push(1); // Always show first page

                        if (currentPage > 3) {
                          pages.push('ellipsis'); // Ellipsis after page 1
                        }

                        // Show pages around current
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);

                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }

                        if (currentPage < totalPages - 2) {
                          pages.push('ellipsis'); // Ellipsis before last page
                        }

                        pages.push(totalPages); // Always show last page
                      }

                      return pages.map((page, index) => {
                        if (page === 'ellipsis') {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }

                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                handleGoToPage(page);
                              }}
                              isActive={page === currentPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      });
                    })()}

                    {/* Next Button */}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => {
                          e.preventDefault();
                          if (paginationLinks.next && !loading) {
                            handleNextPage();
                          }
                        }}
                        className={
                          !paginationLinks.next || loading
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-sm sm:text-base md:text-lg font-medium text-text-primary mb-2">
              No Practitioners Found
            </h3>
            <p className="text-text-secondary mb-4">
              {searchFilters.givenName || searchFilters.familyName ||
               searchFilters.phone || searchFilters.addressCity || searchFilters.addressState ||
               searchFilters.addressPostalCode || searchFilters.addressCountry || searchFilters.practitionerId ? (
                'No practitioners found matching your search criteria.'
              ) : (
                'No practitioners found in the system.'
              )}
            </p>
            {!searchFilters.givenName && !searchFilters.familyName && !searchFilters.phone &&
             !searchFilters.addressCity && !searchFilters.addressState && !searchFilters.addressPostalCode &&
             !searchFilters.addressCountry && !searchFilters.practitionerId && (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Try searching for &quot;Dr&quot; or a specific practitioner name
                </p>
                <Button
                  variant="primary"
                  onClick={handleCreateNew}
                  className="mt-4"
                >
                  Create Your First Practitioner
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create Form Modal */}
        <CreatePractitionerForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* View Details Modal */}
        <ViewPractitionerDetails
          practitioner={selectedPractitioner}
          isOpen={showViewDetails}
          onClose={() => {
            setShowViewDetails(false);
            setSelectedPractitioner(null);
          }}
          onEdit={() => {}}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Practitioner</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this practitioner? This action cannot be undone.
                {practitionerToDelete && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    <strong>
                      {practitionerToDelete.name?.[0]?.text ||
                       `${practitionerToDelete.name?.[0]?.given?.join(' ')} ${practitionerToDelete.name?.[0]?.family}` ||
                       'Unknown Practitioner'}
                    </strong>
                    <br />
                    <span className="text-xs text-gray-500">ID: {practitionerToDelete.id}</span>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowDeleteDialog(false);
                setPractitionerToDelete(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
