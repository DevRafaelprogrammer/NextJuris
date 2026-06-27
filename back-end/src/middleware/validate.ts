import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) (req as any).validatedQuery = schemas.query.parse(req.query);
    if (schemas.params) (req as any).validatedParams = schemas.params.parse(req.params);
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: any;
      validatedParams?: any;
    }
  }
}
