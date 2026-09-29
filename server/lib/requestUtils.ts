import prisma from "./prisma.js";

const MAX_NUMBER_ATTEMPTS = 8;

function randomSuffix(): string {
  return Math.floor(Math.random() * 9000 + 1000).toString();
}

export function generateRequestNumber(): string {
  return `REQ-${new Date().getFullYear()}-${randomSuffix()}`;
}

/** True when the error is Prisma's unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function generateUniqueRequestNumber(): Promise<string> {
  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    const candidate = generateRequestNumber();
    const exists = await prisma.researchRequest.findUnique({ where: { requestNumber: candidate } });
    if (!exists) return candidate;
  }
  return `REQ-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
}

/**
 * Runs `attempt`, re-running it on a unique-constraint violation.
 *
 * Both request numbers and report version numbers are allocated with a
 * read-then-write, which is not atomic: two members submitting at the same
 * moment can be handed the same number. The database is the only authority that
 * can arbitrate this, so the insert itself is the check — on P2002 we recompute
 * and try again. Any other error propagates immediately.
 */
export async function retryOnUniqueViolation<T>(
  attempt: () => Promise<T>,
  maxAttempts = MAX_NUMBER_ATTEMPTS,
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (!isUniqueViolation(error) || i === maxAttempts - 1) {
        throw error;
      }
    }
  }
  // Unreachable: the loop either returns or throws on the final attempt.
  throw new Error("Could not allocate a unique value");
}

/** Allocates a request number and creates the record, retrying on collision. */
export async function createWithUniqueRequestNumber<T>(
  create: (requestNumber: string) => Promise<T>,
): Promise<T> {
  return retryOnUniqueViolation(async () => {
    const requestNumber = await generateUniqueRequestNumber();
    return create(requestNumber);
  });
}

export function lookupByIdOrNumber(idOrNumber: string): { requestNumber: string } | { id: string } {
  return idOrNumber.startsWith('REQ-')
    ? { requestNumber: idOrNumber }
    : { id: idOrNumber };
}
