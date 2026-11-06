import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";

function sendApiError(req: Request, res: Response, status: number, message: string) {
  const code = status === 404 ? "NOT_FOUND" : status === 413 ? "PAYLOAD_TOO_LARGE" : status < 500 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
  const result = { error: { json: {
    message,
    code: status === 404 ? -32004 : status < 500 ? -32600 : -32603,
    data: { code, httpStatus: status },
  } } };
  res.status(status).json(req.query.batch === "1" ? [result] : result);
}

/** Must be registered after API routes and before the SPA fallback. */
export const apiNotFound: RequestHandler = (req, res) => {
  sendApiError(req, res, 404, "The SKU Dash API endpoint was not found. Refresh the page and update the published app if this continues.");
};

/** Keep request parser failures in the JSON API contract without exposing body,
 * database details or credentials in the client response. */
export const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const path = req.originalUrl.split("?")[0];
  if (!/^\/api(?:\/|$)/i.test(path)) return next(error);
  const requestedStatus = Number(error?.status ?? error?.statusCode);
  const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  const message = status === 413 ? "The upload is too large. Use a smaller file and try again."
    : status < 500 ? "The request could not be read. Refresh the page and try again."
    : "The SKU Dash service could not process the request. Refresh and check the saved status before retrying.";
  sendApiError(req, res, status, message);
};
