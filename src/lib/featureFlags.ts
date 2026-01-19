/**
 * Feature flags for deferred features (Stability Iteration 5)
 * 
 * These flags control visibility of features that are being deferred
 * to focus on stability and core functionality.
 */

export const FEATURE_FLAGS = {
  /**
   * Show archetype classification and comparison features
   * @default false - Deferred until stability proven
   */
  SHOW_ARCHETYPE_FEATURES: false,

  /**
   * Show reference library and "nearest creators" comparisons
   * @default false - Deferred until stability proven
   */
  SHOW_REFERENCE_LIBRARY: false,

  /**
   * Show "coming soon" placeholders for deferred features
   * @default true - Let users know features are planned
   */
  SHOW_COMING_SOON_PLACEHOLDERS: true,
} as const;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};
