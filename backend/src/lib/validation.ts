import type { Request, Response } from "express";
import { validationResult } from "express-validator";

/**
 * Run express-validator result; if invalid, send 400 and return false.
 * Use after validators: if (!validateRequest(req, res)) return;
 */
export function validateRequest(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}
