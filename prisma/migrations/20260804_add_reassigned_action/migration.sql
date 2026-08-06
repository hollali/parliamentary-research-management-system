-- Add REASSIGNED to the ActivityAction enum for reassignment audit logging
ALTER TYPE "ActivityAction" ADD VALUE 'REASSIGNED';
