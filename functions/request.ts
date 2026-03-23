import { addBasePath } from "next/dist/client/add-base-path";

export function fetchRequest(input: string | URL | globalThis.Request, init?: RequestInit) {
  if (typeof input === "string") {
    return fetch(addBasePath(input), init);
  }

  if (input instanceof URL) {
    return fetch(input, init);
  }

  return fetch(input, init);
}
