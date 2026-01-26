import { nanoid } from "nanoid";

export function generateId(): string {
  return nanoid(21);
}

export function generateToken(): string {
  return nanoid(48);
}
