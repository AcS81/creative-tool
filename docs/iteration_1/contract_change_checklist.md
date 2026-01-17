# Contract Change Checklist

Use this when modifying the fingerprint schema, metric registry, or default metrics.

- [ ] Update metric lists or schema builders (`src/lib/analysis/metricRegistry.ts`, `src/lib/schemas/fingerprint.ts`).
- [ ] Bump `FINGERPRINT_SCHEMA_VERSION` in `src/lib/schemas/fingerprintContract.ts`.
- [ ] Confirm the new `FINGERPRINT_SCHEMA_HASH` via `src/lib/schemas/fingerprintSchemaHash.ts`.
- [ ] Add or update upgrade steps in `src/lib/schemas/fingerprint.ts`.
- [ ] Run `npm run eval:golden -- --write-baseline` to refresh `scripts/golden-set.baseline.vX.Y.Z.json`.
- [ ] Verify `npm run eval:golden` passes without `--skip-baseline-check`.
