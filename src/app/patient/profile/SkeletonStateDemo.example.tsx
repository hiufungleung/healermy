/**
 * Skeleton State Management Demo
 * 
 * This file demonstrates the complete state handling in your PatientProfileModern component.
 * Copy these patterns to implement similar functionality elsewhere.
 * 
 * NOTE: This is a DOCUMENTATION file showing code patterns.
 * It contains intentional syntax placeholders (...) and is not meant to compile.
 */

// Example imports (for reference only)
// import { SectionCard } from './PatientProfileModern';
// import { Stethoscope } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Complete State Handling (Recommended Pattern)
// ============================================================================

/**
 * Example function showing complete state handling
 * 
 * @example
 * ```tsx
 * export function ConditionsSection() {
 *   // Your existing state from PatientProfileClient.tsx
 *   const [conditions, setConditions] = useState<Condition[]>([]);
 *   const [loading, setLoading] = useState({ conditions: false });
 *   const [errors, setErrors] = useState({ conditions: '' });
 * 
 *   const fetchConditions = async () => {
 *     setLoading(prev => ({ ...prev, conditions: true }));
 *     try {
 *       const response = await fetch('/api/conditions');
 *       const data = await response.json();
 *       setConditions(data);
 *     } catch (error) {
 *       setErrors(prev => ({ 
 *         ...prev, 
 *         conditions: error instanceof Error ? error.message : 'Failed to load' 
 *       }));
 *     } finally {
 *       setLoading(prev => ({ ...prev, conditions: false }));
 *     }
 *   };
 * 
 *   return (
 *     <SectionCard
 *       title="Conditions"
 *       count={conditions.length}
 *       icon={Stethoscope}
 *       // 🔵 State 1: Loading
 *       isLoading={loading.conditions}
 *       // 🔴 State 2: Error
 *       error={errors.conditions}
 *       // ⚪ State 3: Empty
 *       isEmpty={!loading.conditions && conditions.length === 0}
 *       emptyMessage="No conditions recorded"
 *       // 🔄 Retry handler
 *       onRetry={fetchConditions}
 *       // 🎨 Skeleton style
 *       skeletonVariant="list"
 *     >
 *       <div className="space-y-2">
 *         {conditions.map(condition => (
 *           <ConditionItem key={condition.id} condition={condition} />
 *         ))}
 *       </div>
 *     </SectionCard>
 *   );
 * }
 * ```
 */
export const EXAMPLE_1_COMPLETE_STATE_HANDLING = `
See code example above in JSDoc comment
`;

// ============================================================================
// EXAMPLE 2: Graceful Degradation (Optional Resources)
// ============================================================================

/**
 * Example showing graceful degradation for optional features
 * 
 * @example
 * ```tsx
 * export function MedicationDispensesSection() {
 *   const [dispenses, setDispenses] = useState<MedicationDispense[]>([]);
 *   const [loading, setLoading] = useState(false);
 * 
 *   const fetchDispenses = async () => {
 *     setLoading(true);
 *     try {
 *       const response = await fetch('/api/medication-dispenses');
 *       
 *       if (response.status === 500) {
 *         // ✅ Graceful degradation: treat as "no data" instead of error
 *         console.warn('💊 Medication dispenses not supported (500)');
 *         setDispenses([]);
 *         // Note: We DON'T set error state here!
 *         return;
 *       }
 *       
 *       const data = await response.json();
 *       setDispenses(data);
 *     } catch (error) {
 *       // For true network errors, still show empty (optional feature)
 *       setDispenses([]);
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 * 
 *   return (
 *     <SectionCard
 *       title="Medication Dispenses"
 *       count={dispenses.length}
 *       icon={Pill}
 *       isLoading={loading}
 *       // No error prop → 500 errors appear as empty state
 *       isEmpty={!loading && dispenses.length === 0}
 *       emptyMessage="No dispense records"
 *       skeletonVariant="list"
 *     >
 *       {dispenses.map(dispense => (
 *         <DispenseItem key={dispense.id} dispense={dispense} />
 *       ))}
 *     </SectionCard>
 *   );
 * }
 * ```
 */
export const EXAMPLE_2_GRACEFUL_DEGRADATION = `
See code example above in JSDoc comment
`;

// ============================================================================
// EXAMPLE 3: Using Standalone Components (Outside SectionCard)
// ============================================================================

/**
 * Example showing manual state handling with standalone components
 * 
 * @example
 * ```tsx
 * import { EmptyState } from '@/components/common/EmptyState';
 * import { ErrorCard } from '@/components/common/ErrorCard';
 * import { ContentSkeleton } from '@/components/common/ContentSkeleton';
 * 
 * export function CustomSection() {
 *   const { data, loading, error, refetch } = useYourCustomHook();
 * 
 *   // Manual state handling (more control)
 *   if (loading) {
 *     return <ContentSkeleton variant="card" items={3} />;
 *   }
 * 
 *   if (error) {
 *     return (
 *       <ErrorCard
 *         title="Loading Failed"
 *         message={error}
 *         onRetry={refetch}
 *         variant="default"
 *       />
 *     );
 *   }
 * 
 *   if (data.length === 0) {
 *     return (
 *       <EmptyState
 *         icon={ClipboardList}
 *         title="No Data"
 *         message="Start by adding your first record"
 *         actionLabel="Add Record"
 *         onAction={() => console.log('Add record')}
 *         variant="default"
 *       />
 *     );
 *   }
 * 
 *   return (
 *     <div>
 *       {data.map(item => (
 *         <ItemCard key={item.id} item={item} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export const EXAMPLE_3_STANDALONE_COMPONENTS = `
See code example above in JSDoc comment
`;

// ============================================================================
// EXAMPLE 4: Multiple Data Sources in One Section
// ============================================================================

/**
 * Example showing combined data sources with shared loading state
 * 
 * @example
 * ```tsx
 * export function CombinedHealthSection() {
 *   const [conditions, setConditions] = useState<Condition[]>([]);
 *   const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
 *   const [loading, setLoading] = useState({ 
 *     conditions: false, 
 *     allergies: false 
 *   });
 * 
 *   // Combined loading state
 *   const isLoading = loading.conditions || loading.allergies;
 *   const isEmpty = conditions.length === 0 && allergies.length === 0;
 * 
 *   return (
 *     <SectionCard
 *       title="Health Overview"
 *       count={conditions.length + allergies.length}
 *       icon={Activity}
 *       isLoading={isLoading}
 *       isEmpty={!isLoading && isEmpty}
 *       emptyMessage="No health records"
 *       skeletonVariant="card"
 *     >
 *       {conditions.length > 0 && (
 *         <div>
 *           <h3>Conditions</h3>
 *           {conditions.map(condition => (
 *             <ConditionItem key={condition.id} condition={condition} />
 *           ))}
 *         </div>
 *       )}
 *       {allergies.length > 0 && (
 *         <div>
 *           <h3>Allergies</h3>
 *           {allergies.map(allergy => (
 *             <AllergyItem key={allergy.id} allergy={allergy} />
 *           ))}
 *         </div>
 *       )}
 *     </SectionCard>
 *   );
 * }
 * ```
 */
export const EXAMPLE_4_MULTIPLE_DATA_SOURCES = `
See code example above in JSDoc comment
`;

// ============================================================================
// VISUAL TIMELINE (What User Sees)
// ============================================================================

/*

T+0.0s: User clicks "Patient Profile"
┌─────────────────────────────┐
│ [Loading...]                │
│                             │
│ ▓▓▓▓▓░░░░░░ (pulse animation)│  ← ContentSkeleton
│ ▓▓▓▓░░░░░░                  │
│ ▓▓▓▓▓▓░░░░                  │
└─────────────────────────────┘

T+0.5s: API returns 200 OK with data
┌─────────────────────────────┐
│ Conditions (3 records)      │
│                             │
│ ├─ Hypertension [active]    │  ← Real Data
│ ├─ Diabetes [active]        │
│ └─ Asthma [inactive]        │
└─────────────────────────────┘

Alternative: API returns 404 (no data)
┌─────────────────────────────┐
│ Conditions (0 records)      │
│                             │
│   🩺                        │  ← EmptyState
│   No conditions recorded    │
└─────────────────────────────┘

Alternative: API returns 500 (error)
┌─────────────────────────────┐
│ Conditions                  │
│                             │
│ ⚠️ Loading Failed           │  ← ErrorCard
│    Cannot connect to server │
│    [Reload]                 │
└─────────────────────────────┘

*/

// ============================================================================
// TESTING HELPERS
// ============================================================================

/**
 * Testing helper functions
 * 
 * @example
 * ```tsx
 * // Simulate slow network for testing Skeleton
 * export async function slowFetch(url: string, delay = 2000) {
 *   await new Promise(resolve => setTimeout(resolve, delay));
 *   return fetch(url);
 * }
 * 
 * // Test different states
 * export const testStates = {
 *   loading: { loading: { conditions: true }, conditions: [], errors: {} },
 *   success: { loading: {}, conditions: [mock data], errors: {} },
 *   empty: { loading: {}, conditions: [], errors: {} },
 *   error: { loading: {}, conditions: [], errors: { conditions: 'Network error' } },
 * };
 * 
 * // Usage in Storybook or dev tools
 * export function ConditionsSectionDemo({ state = 'loading' }) {
 *   const mockState = testStates[state as keyof typeof testStates];
 *   return <ConditionsSection {...mockState} />;
 * }
 * ```
 */
export const TESTING_HELPERS = `
See code examples above in JSDoc comment
`;

// Export a summary for quick reference
export const SKELETON_STATE_PATTERNS = {
  COMPLETE_STATE: 'isLoading, error, isEmpty, data',
  GRACEFUL_DEGRADATION: 'Treat 500 errors as empty state for optional features',
  STANDALONE_COMPONENTS: 'Use EmptyState, ErrorCard, ContentSkeleton directly',
  MULTIPLE_SOURCES: 'Combine multiple loading states with OR/AND logic',
  TESTING: 'Use slowFetch and mock states for development'
} as const;
