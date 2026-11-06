/** Keep gateway/login/SPA HTML out of tRPC's JSON decoder. Never retry a mutation:
 * a lost response does not prove the database write failed. */
export function requireTrpcJsonResponse(response: Response): Response {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/.test(contentType) && !response.redirected) {
    return response;
  }
  if (response.redirected || response.status === 401 || response.status === 403) {
    throw new Error("Your SKU Dash connection needs to be refreshed. Reload the page and sign in again before retrying.");
  }
  if (response.status === 404) {
    throw new Error("The SKU Dash save service could not be reached. Refresh the page; if this continues, the published app needs to be updated.");
  }
  throw new Error("SKU Dash returned a webpage instead of a save response. Refresh the page and check the sample status before retrying.");
}
