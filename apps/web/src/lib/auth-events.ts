export const LA_UNAUTHORIZED_EVENT = "la:unauthorized";

export function emitUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LA_UNAUTHORIZED_EVENT));
  }
}
