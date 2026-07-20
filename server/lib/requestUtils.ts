import prisma from "./prisma.js";

export function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000 + 1000);
  return `REQ-${year}-${seq}`;
}

export async function generateUniqueRequestNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateRequestNumber();
    const exists = await prisma.researchRequest.findUnique({ where: { requestNumber: candidate } });
    if (!exists) return candidate;
  }
  const ts = Date.now().toString().slice(-8);
  return `REQ-${new Date().getFullYear()}-${ts}`;
}

export function lookupByIdOrNumber(idOrNumber: string): { requestNumber: string } | { id: string } {
  return idOrNumber.startsWith('REQ-')
    ? { requestNumber: idOrNumber }
    : { id: idOrNumber };
}
