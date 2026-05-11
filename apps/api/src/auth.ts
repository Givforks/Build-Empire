import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "build-empire-dev-secret";

export interface AuthPayload {
  userId: string;
  role: Role;
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = auth.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as Request & { auth?: AuthPayload }).auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: AuthPayload }).auth;
    if (!auth || !roles.includes(auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}