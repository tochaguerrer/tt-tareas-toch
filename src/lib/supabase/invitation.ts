import { createHash } from "node:crypto";

export function invitationDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
