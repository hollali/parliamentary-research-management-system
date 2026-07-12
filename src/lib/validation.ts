export interface ValidationError {
  field: string;
  message: string;
}

export function validateRequired(value: string, fieldName: string): string | null {
  return value?.trim() ? null : `${fieldName} is required`;
}

export function validateEmail(email: string): string | null {
  if (!email?.trim()) return 'Email is required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Invalid email format';
}

export function validateDeadline(deadline: string): string | null {
  if (!deadline) return 'Deadline is required';
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return 'Invalid date format';
  if (date < new Date()) return 'Deadline must be in the future';
  return null;
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (!value?.trim()) return `${fieldName} is required`;
  return value.trim().length >= min ? null : `${fieldName} must be at least ${min} characters`;
}

export function validateForm(fields: Record<string, { value: string; validators: ((val: string) => string | null)[] }>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [field, { value, validators }] of Object.entries(fields)) {
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        errors.push({ field, message: error });
        break;
      }
    }
  }
  return errors;
}
