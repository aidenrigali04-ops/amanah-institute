import type { Request, Response, NextFunction } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps async route handlers so rejections are passed to Express error handler.
 * Use: router.get("/path", asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
