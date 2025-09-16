# 🎯 Automated Slot Management System

## Overview

This system ensures that slot status **automatically follows appointment status changes** with **no manual manipulation** required. All slot status updates are handled transparently whenever appointments are created, updated, or changed.

Uses official **FHIR R4 Slot Status ValueSet** from: https://hl7.org/fhir/valueset-slotstatus.html

## 🔄 Automatic Status Mapping

The system uses a deterministic mapping between appointment statuses and **official FHIR R4 slot statuses**:

### Appointment Status → FHIR R4 Slot Status

| Appointment Status | FHIR Slot Status | Official Definition |
|-------------------|------------------|-------------------|
| `pending` | `busy` | **🚫 Time interval is busy - prevents double-booking while awaiting approval** |
| `booked` | `busy` | Time interval is busy because one or more events have been scheduled |
| `arrived` | `busy` | Time interval is busy because one or more events have been scheduled |
| `checked-in` | `busy` | Time interval is busy because one or more events have been scheduled |
| `fulfilled` | `busy` | Time interval is busy because one or more events have been scheduled |
| `proposed` | `busy-tentative` | Time interval is busy because events have been tentatively scheduled |
| `cancelled` | `free` | Time interval is free for scheduling |
| `noshow` | `free` | Time interval is free for scheduling |
| `waitlist` | `free` | Time interval is free for scheduling |
| `entered-in-error` | `entered-in-error` | This instance should not have been part of this patient's medical record |

## 🚀 Automatic Triggers

Slot status updates are automatically triggered on:

### 1. **Appointment Creation** (`POST /api/fhir/appointments`)
```typescript
// When appointment is created, slot status follows appointment status
await manageSlotStatusForAppointment(token, fhirBaseUrl, appointmentData, undefined, appointmentData.status);
```

### 2. **Appointment Updates** (`PUT /api/fhir/appointments/[id]`)
```typescript
// When appointment is updated, slot status transitions with status change
await manageSlotStatusForAppointment(token, fhirBaseUrl, appointmentData, oldStatus, newStatus);
```

### 3. **Appointment Patches** (`PATCH /api/fhir/appointments/[id]`)
```typescript
// When appointment status is patched, slot status updates automatically
if (statusPatch) {
  await manageSlotStatusForAppointment(token, fhirBaseUrl, currentAppointment, oldStatus, newStatus);
}
```

## 🛡️ Fail-Safe Design

### Non-Blocking Updates
- **Appointment operations succeed even if slot updates fail**
- Slot update errors are logged but don't break the appointment workflow
- Graceful handling of missing slot references

### Idempotent Operations  
- **Only updates slot status when it actually needs to change**
- Compares old vs new slot status before making PATCH calls
- Prevents unnecessary API calls

### Multi-Slot Support
- **Handles appointments that reference multiple slots**
- Updates all referenced slots consistently
- Continues processing other slots if one fails

## 🔍 Comprehensive Coverage

### All Entry Points Covered
✅ **Direct API calls** - All appointment API routes  
✅ **Provider approval/rejection** - Pending appointments page  
✅ **Patient booking** - Appointment creation  
✅ **Status transitions** - Any appointment status change  
✅ **Bulk operations** - Multiple appointments  

### All Status Transitions Covered  
✅ **pending → booked** (approval): `busy → busy` (no change)  
✅ **booked → cancelled** (cancellation): `busy → free`  
✅ **pending → cancelled** (rejection): `busy → free`  
✅ **booked → fulfilled** (completion): `busy → busy` (no change)  
✅ **proposed → booked** (confirmation): `busy-tentative → busy`  
✅ **Any → entered-in-error** (error): `* → entered-in-error`  

## 📋 Implementation Details

### Core Function
```typescript
async function manageSlotStatusForAppointment(
  token: string,
  fhirBaseUrl: string, 
  appointment: any,
  oldStatus?: string,
  newStatus?: string
): Promise<void>
```

### Status Mapping Function
```typescript
function getSlotStatusFromAppointmentStatus(appointmentStatus: string): 
  'busy' | 'free' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error'
// Uses official FHIR R4 slot status codes
```

### Slot Reference Extraction
```typescript
function extractSlotReferences(appointment: any): string[]
// Handles: appointment.slot[].reference and extensions
```

## 🎯 Real-World Scenarios

### Patient Books Appointment
1. Patient submits booking request → `status: 'pending'`
2. **Automatic**: Slot becomes `busy` (**prevents double-booking**)
3. Provider approves → PATCH `status: 'pending' → 'booked'`
4. **Automatic**: Slot remains `busy` (no change needed)

### Provider Cancels Appointment  
1. Appointment currently `status: 'booked'`, slot `busy`
2. Provider cancels → PATCH `status: 'booked' → 'cancelled'` 
3. **Automatic**: Slot becomes `free` (cancelled releases slot)

### Patient Doesn't Show
1. Appointment `status: 'booked'`, slot `busy`
2. Provider marks no-show → PATCH `status: 'booked' → 'noshow'`
3. **Automatic**: Slot becomes `free` (noshow releases slot)

## ✅ Zero Manual Intervention

- **No manual slot status management required**
- **No administrative overhead**  
- **No risk of slot/appointment desynchronization**
- **Fully automated and transparent**
- **Oracle FHIR specification compliant**

The system ensures that slots **always reflect the true appointment status** without any manual management required.