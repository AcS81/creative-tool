import crypto from "node:crypto";
import { FINGERPRINT_SCHEMA_SIGNATURE } from "./fingerprintContract";

export const buildFingerprintSchemaHash = () => {
  const serialized = JSON.stringify(FINGERPRINT_SCHEMA_SIGNATURE);
  return crypto.createHash("sha256").update(serialized).digest("hex");
};

export const FINGERPRINT_SCHEMA_HASH = buildFingerprintSchemaHash();
