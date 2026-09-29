import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import JWT_SECRET, { JWT_EXPIRY } from "../lib/jwt.js";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export interface AuthPayload {
  userId: string;
  role: string;
}

/** How long an isActive check is trusted before re-querying the database. */
const ACTIVE_USER_CACHE_MS = 15_000;
const activeUserCache = new Map<string, { active: boolean; checkedAt: number }>();

/** Exposed for tests and for the deactivate route to invalidate immediately. */
export function invalidateActiveUserCache(userId?: string) {
  if (userId) activeUserCache.delete(userId);
  else activeUserCache.clear();
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (err) {
    // An expired or malformed token is an authentication failure, not an
    // authorization one. Returning 401 here lets the client tell "session
    // over, log in again" apart from "you may not do this".
    const expired = err instanceof jwt.TokenExpiredError;
    return res.status(401).json({
      error: expired ? "Session expired, please sign in again" : "Invalid token",
    });
  }

  // Re-read the user row. A token is a bearer credential that stays valid for
  // its whole lifetime, so without this a deactivated account keeps full
  // access until the token expires, and a role change would not take effect.
  verifyActiveUser(payload, res, (active) => {
    if (!active) return;
    req.user = payload;
    next();
  });
}

type ActiveCheckCallback = (active: boolean) => void;

/**
 * Confirm the user behind a verified token still exists and is active.
 * Continues with `false` rather than responding so the caller controls the
 * error shape.
 */
function verifyActiveUser(payload: AuthPayload, res: Response, done: ActiveCheckCallback) {
  const cached = activeUserCache.get(payload.userId);
  // Brief cache so a burst of requests from one user does not become a burst
  // of identical SELECTs. Deactivation is reflected within this window.
  if (cached && Date.now() - cached.checkedAt < ACTIVE_USER_CACHE_MS) {
    return done(cached.active);
  }

  prisma.user
    .findUnique({
      where: { id: payload.userId },
      select: { isActive: true },
    })
    .then((user) => {
      const active = user?.isActive === true;
      if (user) {
        activeUserCache.set(payload.userId, { active, checkedAt: Date.now() });
      }
      if (!active) {
        res.status(401).json({ error: "Account is inactive" });
        return;
      }
      done(true);
    })
    .catch((error) => {
      logger.error("Failed to verify active user", { error });
      res.status(500).json({ error: "Internal server error" });
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY as jwt.SignOptions["expiresIn"] });
}
