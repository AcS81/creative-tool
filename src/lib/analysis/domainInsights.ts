import type { VideoFingerprintJson } from "../types";
import { axisLabels, generateInsights } from "./insights";

type DomainKey = keyof VideoFingerprintJson["perDomain"];

const axisByDomain: Record<DomainKey, Array<keyof VideoFingerprintJson["metaAxes"]>> = {
  voiceProfile: ["voiceIntensity"],
  languageProfile: ["conceptualDepth"],
  narrativeProfile: ["narrativeStructureStrength"],
  visualProfile: ["visualDynamism"],
  editingProfile: ["visualDynamism", "productionPolish"],
  soundProfile: ["productionPolish"],
};

export function generateDomainInsights(
  fingerprint: VideoFingerprintJson,
  referenceMeta: VideoFingerprintJson["metaAxes"][],
): Record<DomainKey, string[]> {
  const cleanedRefs = (referenceMeta ?? []).filter(
    (ref): ref is VideoFingerprintJson["metaAxes"] =>
      !!ref && typeof ref.voiceIntensity === "number",
  );

  if (!fingerprint?.metaAxes || cleanedRefs.length === 0) {
    return {
      voiceProfile: [],
      languageProfile: [],
      narrativeProfile: [],
      visualProfile: [],
      editingProfile: [],
      soundProfile: [],
    };
  }

  const meta = fingerprint.metaAxes;
  const allInsights = generateInsights(meta, cleanedRefs);
  const domainInsights: Record<DomainKey, string[]> = {
    voiceProfile: [],
    languageProfile: [],
    narrativeProfile: [],
    visualProfile: [],
    editingProfile: [],
    soundProfile: [],
  };

  (Object.keys(domainInsights) as DomainKey[]).forEach((domain) => {
    try {
      const axes = axisByDomain[domain] ?? [];
      const bullets = (allInsights.bullets ?? []).filter(
        (text) =>
          typeof text === "string" &&
          axes.some((axis) => {
            const label = axisLabels[axis];
            return label ? text.includes(label) : false;
          }),
      );
      domainInsights[domain] = bullets.slice(0, 3);
    } catch {
      domainInsights[domain] = [];
    }
  });

  return domainInsights;
}

export { axisLabels };
