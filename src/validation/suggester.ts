import { TableConfig, ValidationMessage } from './types';

// Suggestion algorithm: take an invalid config and apply the MINIMAL set of
// changes needed to resolve each violation, preserving all valid user choices.

export function generateSuggestion(
  original: TableConfig,
  violations: ValidationMessage[],
): TableConfig {
  // Deep clone so we don't mutate the original
  const suggested: TableConfig = { ...original };

  for (const violation of violations) {
    applyFix(suggested, violation);
  }

  // Recalculate totalHeight after possible thickness change
  suggested.totalHeightMm = suggested.legHeightMm + suggested.topThicknessMm;

  return suggested;
}

function applyFix(config: TableConfig, violation: ValidationMessage): void {
  switch (violation.ruleId) {

    // MAT-01: bump thickness to material minimum
    case 'MAT-01': {
      const matMin: Record<string, number> = {
        sintered_stone: 12,
        quartz:         20,
        marble:         20,
        granite:        20,
      };
      const min = matMin[config.topMaterial] ?? 20;
      if (config.topThicknessMm < min) {
        config.topThicknessMm = min;
      }
      break;
    }

    // MAT-02: bump thickness to span-based minimum
    case 'MAT-02': {
      const spanMin = spanBasedMinThickness(config);
      if (config.topThicknessMm < spanMin) {
        config.topThicknessMm = spanMin;
      }
      break;
    }

    // SPAN-01: either increase thickness or reduce top length
    case 'SPAN-01': {
      // Prefer increasing thickness as a first fix
      const requiredThickness = minThicknessForSpan(config.topMaterial, config.topLengthMm);
      if (requiredThickness !== null) {
        config.topThicknessMm = Math.max(config.topThicknessMm, requiredThickness);
      } else {
        // No valid thickness — reduce length to fit current thickness
        const maxLen = maxSpanForThickness(config.topMaterial, config.topThicknessMm);
        if (maxLen !== null) config.topLengthMm = maxLen;
      }
      break;
    }

    // SPAN-02: pedestal — increase thickness or reduce top size
    case 'SPAN-02': {
      // Try 30mm first; if still too large, reduce top
      if (config.topThicknessMm < 30) {
        config.topThicknessMm = 30;
      } else {
        // At 30mm max diagonal is 1200mm — reduce length/width to fit
        const maxDiag = 1200;
        const currentDiag = Math.sqrt(config.topLengthMm ** 2 + config.topWidthMm ** 2);
        if (currentDiag > maxDiag) {
          const scale = maxDiag / currentDiag;
          config.topLengthMm = Math.floor(config.topLengthMm * scale);
          config.topWidthMm  = Math.floor(config.topWidthMm  * scale);
        }
      }
      break;
    }

    // STAB-01: widen table or lower height — we widen (less destructive to user intent)
    case 'STAB-01': {
      const minWidth = Math.ceil(0.45 * config.totalHeightMm);
      if (config.topWidthMm < minWidth) {
        config.topWidthMm = minWidth;
      }
      break;
    }

    // STAB-02: pedestal base too small — increase leg profile
    case 'STAB-02': {
      const minBase = Math.ceil(0.4 * config.totalHeightMm);
      if (config.legProfileSizeMm < minBase) {
        config.legProfileSizeMm = minBase;
      }
      break;
    }

    // STAB-03: require foot base
    case 'STAB-03': {
      config.hasFootBase = true;
      break;
    }

    // LEG-01: bump metal leg profile to minimum
    case 'LEG-01': {
      const metalMin: Record<string, number> = {
        round: 30,
        square: 40,
        rectangular: 40,
      };
      const min = metalMin[config.legProfileType] ?? 40;
      if (config.legProfileSizeMm < min) {
        config.legProfileSizeMm = min;
      }
      break;
    }

    // LEG-02: bump wood leg profile to minimum
    case 'LEG-02': {
      const min = config.legHeightMm >= 750 ? 80 : 60;
      if (config.legProfileSizeMm < min) {
        config.legProfileSizeMm = min;
      }
      break;
    }

    // LEG-03: fix slenderness — increase profile size
    case 'LEG-03': {
      const maxSlenderness = isWoodMaterial(config.legMaterial) ? 15 : 25;
      const minProfile = Math.ceil(config.legHeightMm / maxSlenderness);
      if (config.legProfileSizeMm < minProfile) {
        config.legProfileSizeMm = minProfile;
      }
      break;
    }

    // LEG-04: pedestal on non-round/square top — change to 4 legs
    case 'LEG-04': {
      config.legCount = 4;
      if (config.legProfileType === 'pedestal') {
        config.legProfileType = 'square';
      }
      break;
    }

    // HGT-01: clamp totalHeight to valid range
    case 'HGT-01': {
      if (config.totalHeightMm < 550) {
        config.totalHeightMm = 550;
        config.legHeightMm = 550 - config.topThicknessMm;
      } else if (config.totalHeightMm > 1100) {
        config.totalHeightMm = 1100;
        config.legHeightMm = 1100 - config.topThicknessMm;
      }
      break;
    }

    // HGT-03: fix totalHeight to match leg + top
    case 'HGT-03': {
      config.totalHeightMm = config.legHeightMm + config.topThicknessMm;
      break;
    }

    // EDGE-01: mitered edge needs 20mm
    case 'EDGE-01': {
      if (config.topThicknessMm < 20) {
        config.topThicknessMm = 20;
      }
      break;
    }

    // EDGE-02: beveled edge needs 12mm — if below, bump up or switch to straight
    case 'EDGE-02': {
      if (config.topThicknessMm < 12) {
        // Can't fix by increasing thickness alone for sintered_stone 6mm case —
        // switch to straight edge as the minimal change
        config.topEdgeFinish = 'straight';
      } else {
        config.topThicknessMm = 12;
      }
      break;
    }

    // COMP-01: face panel too thin — bump to material minimum
    case 'COMP-01': {
      const faceMin: Record<string, number> = {
        sintered_stone: 6,
        quartz:         12,
        marble:         12,
        granite:        12,
      };
      const min = faceMin[config.topMaterial] ?? 12;
      if ((config.topFaceThicknessMm ?? 0) < min) {
        config.topFaceThicknessMm = min;
      }
      break;
    }

    // COMP-02: core too thin — increase total thickness to satisfy min core
    case 'COMP-02': {
      const face = config.topFaceThicknessMm ?? 6;
      const minTotal = 2 * face + 10;
      if (config.topThicknessMm < minTotal) {
        config.topThicknessMm = minTotal;
      }
      break;
    }

    // COMP-03: total thickness inconsistent — same fix as COMP-02
    case 'COMP-03': {
      const face = config.topFaceThicknessMm ?? 6;
      const minTotal = 2 * face + 10;
      if (config.topThicknessMm < minTotal) {
        config.topThicknessMm = minTotal;
      }
      break;
    }

    // RADIAL-01: spread too small — set to minimum (0.4 × totalHeight)
    case 'RADIAL-01': {
      const minSpread = Math.ceil(0.4 * config.totalHeightMm);
      if ((config.legRadialSpreadMm ?? 0) < minSpread) {
        config.legRadialSpreadMm = minSpread;
      }
      break;
    }

    // RADIAL-02: too few halfcylinders — set to minimum 3
    case 'RADIAL-02': {
      config.legRadialCount = 3;
      break;
    }

    // RADIAL-03: halfcylinder diameter too small — bump to 60mm
    case 'RADIAL-03': {
      if (config.legProfileSizeMm < 60) {
        config.legProfileSizeMm = 60;
      }
      break;
    }

    // Warnings (LEG-05) — no structural fix needed
    default:
      break;
  }
}

// Helpers

function isWoodMaterial(material: string): boolean {
  return material === 'solid_wood' || material === 'laminated_wood';
}

function spanBasedMinThickness(config: TableConfig): number {
  const { topMaterial, topLengthMm } = config;
  if (topMaterial === 'sintered_stone' && topLengthMm > 1200) return 20;
  if ((topMaterial === 'marble' || topMaterial === 'granite') && topLengthMm > 1400) return 30;
  return config.topThicknessMm; // already valid
}

function minThicknessForSpan(material: string, spanMm: number): number | null {
  if (material === 'sintered_stone') {
    if (spanMm <= 900)  return 12;
    if (spanMm <= 1800) return 20;
    if (spanMm <= 2400) return 30;
    return null; // span too large for any standard thickness
  }
  if (material === 'quartz' || material === 'marble' || material === 'granite') {
    if (spanMm <= 1400) return 20;
    if (spanMm <= 2400) return 30;
    return null;
  }
  return null;
}

function maxSpanForThickness(material: string, thickness: number): number | null {
  if (material === 'sintered_stone') {
    if (thickness >= 30) return 2400;
    if (thickness >= 20) return 1800;
    if (thickness >= 12) return 900;
  }
  if (material === 'quartz' || material === 'marble' || material === 'granite') {
    if (thickness >= 30) return 2400;
    if (thickness >= 20) return 1400;
  }
  return null;
}
