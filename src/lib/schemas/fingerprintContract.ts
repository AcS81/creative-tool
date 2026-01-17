import { ADVANCED_METRIC_SECTIONS, SECOND_ORDER_METRICS } from "../analysis/metricRegistry";

export const FINGERPRINT_SCHEMA_VERSION = "1.3.0" as const;

export const FINGERPRINT_SCHEMA_SIGNATURE = {
  version: FINGERPRINT_SCHEMA_VERSION,
  advancedSections: ADVANCED_METRIC_SECTIONS,
  secondOrderMetrics: SECOND_ORDER_METRICS,
};
