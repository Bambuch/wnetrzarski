import { TableConfig, FieldConstraints } from './types';
import { MATERIAL_MIN_THICKNESS, MATERIAL_SPAN_UPGRADE } from './rules/materialRules';
import { SPAN_LIMITS_4LEG } from './rules/spanRules';
import { MIN_STABILITY_RATIO, PEDESTAL_BASE_RATIO } from './rules/stabilityRules';
import {
  LEG_MIN_PROFILES,
  WOOD_MIN_PROFILE_SHORT, WOOD_MIN_PROFILE_TALL, WOOD_TALL_THRESHOLD,
  MAX_SLENDERNESS_METAL, MAX_SLENDERNESS_WOOD,
  RADIAL_MIN_DIAMETER_MM, RADIAL_SPREAD_RATIO,
} from './rules/legRules';
import { EDGE_MIN_THICKNESS } from './rules/edgeRules';
import { COMPOSITE_FACE_MIN, MIN_CORE_MM } from './rules/compositeRules';
import { MIN_TOTAL_HEIGHT, MAX_TOTAL_HEIGHT } from './rules/heightRules';

// Absolute physical bounds — never crossed regardless of config.
const ABS = {
  topThickness: { min: 6,   max: 60   },
  topFace:      { min: 3,   max: 30   },
  topLength:    { min: 200, max: 4000 },
  topWidth:     { min: 100, max: 2000 },
  legProfile:   { min: 10,  max: 500  },
  radialSpread: { min: 50,  max: 1500 },
};

const METAL_MATERIALS = new Set(['steel', 'stainless_steel', 'aluminum']);
const WOOD_MATERIALS  = new Set(['solid_wood', 'laminated_wood']);

/**
 * Returns valid ranges for each numeric field given whatever the user has
 * configured so far. All constraints are derived from the same constants
 * used by the validation rules — single source of truth.
 */
export function getFieldConstraints(partial: Partial<TableConfig>): FieldConstraints {
  return {
    topThicknessMm:    topThicknessConstraint(partial),
    topFaceThicknessMm: topFaceConstraint(partial),
    topLengthMm:       topLengthConstraint(partial),
    topWidthMm:        topWidthConstraint(partial),
    totalHeightMm:     totalHeightConstraint(),
    legProfileSizeMm:  legProfileConstraint(partial),
    legRadialSpreadMm: radialSpreadConstraint(partial),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// topThicknessMm
// ─────────────────────────────────────────────────────────────────────────────
function topThicknessConstraint(p: Partial<TableConfig>) {
  let min = ABS.topThickness.min;
  let reason = 'Minimum produkcyjne';

  const isComposite = p.topConstruction === 'composite';

  if (isComposite) {
    // Total thickness must accommodate two face panels + minimum core.
    const faceMin = p.topFaceThicknessMm
      ?? (p.topMaterial ? (COMPOSITE_FACE_MIN[p.topMaterial] ?? 6) : 6);
    const minTotal = 2 * faceMin + MIN_CORE_MM;
    if (minTotal > min) {
      min = minTotal;
      reason = `Kompozyt: 2 × ${faceMin}mm tafle + ${MIN_CORE_MM}mm rdzeń = min. ${minTotal}mm`;
    }
    // Edge finish applies to the face panel (handled in topFaceConstraint), not total.
  } else {
    // MAT-01 — material absolute minimum
    if (p.topMaterial) {
      const matMin = MATERIAL_MIN_THICKNESS[p.topMaterial] ?? ABS.topThickness.min;
      if (matMin > min) {
        min = matMin;
        reason = `${ml(p.topMaterial)} wymaga min. ${matMin}mm (wytrzymałość mechaniczna)`;
      }
    }

    // MAT-02 — span-based upgrade
    if (p.topMaterial && p.topLengthMm != null) {
      for (const rule of MATERIAL_SPAN_UPGRADE) {
        if (rule.materials.includes(p.topMaterial) && p.topLengthMm > rule.spanThresholdMm) {
          if (rule.minThicknessMm > min) {
            min = rule.minThicknessMm;
            reason = `${ml(p.topMaterial)} przy długości ${p.topLengthMm}mm wymaga min. ${min}mm (ugięcie)`;
          }
        }
      }
    }

    // SPAN-01 — minimum thickness to support the span
    if (p.topMaterial && p.topLengthMm != null && p.legCount != null
        && p.legCount > 1 && p.legProfileType !== 'radial_halfcylinder') {
      const spanMin = minThicknessForSpan(p.topMaterial, p.topLengthMm, 1.0);
      if (spanMin !== null && spanMin > min) {
        min = spanMin;
        reason = `${ml(p.topMaterial)} przy długości ${p.topLengthMm}mm wymaga min. ${min}mm (reguła rozpiętości)`;
      }
    }

    // EDGE finish minimum (applies to solid top total thickness)
    if (p.topEdgeFinish) {
      const edgeMin = EDGE_MIN_THICKNESS[p.topEdgeFinish];
      if (edgeMin !== undefined && edgeMin > min) {
        min = edgeMin;
        reason = `Wykończenie "${edgeLabel(p.topEdgeFinish)}" wymaga min. ${edgeMin}mm grubości blatu`;
      }
    }
  }

  const recommended = isComposite ? min : recommendedThickness(p.topMaterial, p.topLengthMm, min);
  return { min, max: ABS.topThickness.max, recommended, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// topFaceThicknessMm  (composite only)
// ─────────────────────────────────────────────────────────────────────────────
function topFaceConstraint(p: Partial<TableConfig>) {
  let min = ABS.topFace.min;
  let reason = 'Minimum produkcyjne tafli';

  if (p.topConstruction === 'composite' && p.topMaterial) {
    const faceMin = COMPOSITE_FACE_MIN[p.topMaterial] ?? ABS.topFace.min;
    if (faceMin > min) {
      min = faceMin;
      reason = `${ml(p.topMaterial)} w kompozycie: min. ${faceMin}mm grubości tafli (COMP-01)`;
    }
  }

  // Edge finish applies to face panel when composite
  if (p.topConstruction === 'composite' && p.topEdgeFinish) {
    const edgeMin = EDGE_MIN_THICKNESS[p.topEdgeFinish];
    if (edgeMin !== undefined && edgeMin > min) {
      min = edgeMin;
      reason = `Wykończenie "${edgeLabel(p.topEdgeFinish)}" wymaga min. ${edgeMin}mm tafli`;
    }
  }

  // Max: half the total thickness minus half the minimum core, so core stays ≥ MIN_CORE_MM
  const maxFromTotal = p.topThicknessMm != null
    ? Math.floor((p.topThicknessMm - MIN_CORE_MM) / 2)
    : ABS.topFace.max;
  const max = Math.max(min, Math.min(ABS.topFace.max, maxFromTotal));

  const recommended = min;
  return { min, max, recommended, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// topLengthMm
// ─────────────────────────────────────────────────────────────────────────────
function topLengthConstraint(p: Partial<TableConfig>) {
  let max = ABS.topLength.max;
  let reason = 'Maksymalny wymiar produkcyjny';

  const compositeMultiplier = p.topConstruction === 'composite' ? 1.4 : 1.0;

  if (p.topMaterial && p.topThicknessMm != null
      && p.legCount != null && p.legCount > 1
      && p.legProfileType !== 'radial_halfcylinder') {
    const spanMax = maxSpanForThickness(p.topMaterial, p.topThicknessMm, compositeMultiplier);
    if (spanMax !== null && spanMax < max) {
      max = spanMax;
      const bonus = compositeMultiplier > 1 ? ' (bonus kompozytu ×1.4)' : '';
      reason = `${ml(p.topMaterial)} ${p.topThicknessMm}mm: max rozpiętość ${max}mm${bonus}`;
    }
  }

  return { min: ABS.topLength.min, max, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// topWidthMm
// ─────────────────────────────────────────────────────────────────────────────
function topWidthConstraint(p: Partial<TableConfig>) {
  let min = ABS.topWidth.min;
  let reason = 'Minimum produkcyjne';

  if (p.legProfileType !== 'radial_halfcylinder' && p.totalHeightMm != null) {
    const stabilityMin = Math.ceil(MIN_STABILITY_RATIO * p.totalHeightMm);
    if (stabilityMin > min) {
      min = stabilityMin;
      reason = `Stateczność: min. ${min}mm szerokości (≥ ${Math.round(MIN_STABILITY_RATIO * 100)}% wysokości ${p.totalHeightMm}mm)`;
    }
  }

  return { min, max: ABS.topWidth.max, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// totalHeightMm — fixed ergonomic range, always the same
// ─────────────────────────────────────────────────────────────────────────────
function totalHeightConstraint() {
  return {
    min: MIN_TOTAL_HEIGHT,
    max: MAX_TOTAL_HEIGHT,
    reason: `Ergonomia: od ${MIN_TOTAL_HEIGHT}mm (stół kawowy) do ${MAX_TOTAL_HEIGHT}mm (stół barowy)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// legProfileSizeMm
// ─────────────────────────────────────────────────────────────────────────────
function legProfileConstraint(p: Partial<TableConfig>) {
  let min = ABS.legProfile.min;
  let reason = 'Minimum strukturalne';

  if (p.legProfileType === 'radial_halfcylinder') {
    if (RADIAL_MIN_DIAMETER_MM > min) {
      min = RADIAL_MIN_DIAMETER_MM;
      reason = `Półwalce promieniowe: min. ${RADIAL_MIN_DIAMETER_MM}mm średnicy (RADIAL-03)`;
    }
    return { min, max: ABS.legProfile.max, reason };
  }

  const isMetal = METAL_MATERIALS.has(p.legMaterial ?? '');
  const isWood  = WOOD_MATERIALS.has(p.legMaterial ?? '');

  // LEG-01 — metal profile type minimum
  if (isMetal && p.legProfileType && p.legMaterial) {
    const rule = LEG_MIN_PROFILES.find(
      r => r.materials.includes(p.legMaterial!) && r.profileType === p.legProfileType,
    );
    if (rule && rule.minSizeMm > min) {
      min = rule.minSizeMm;
      reason = `Metalowa noga "${profileLabel(p.legProfileType)}" wymaga min. ${min}mm przekroju (LEG-01)`;
    }
  }

  // LEG-02 — wood minimum by height
  if (isWood && p.legHeightMm != null) {
    const woodMin = p.legHeightMm >= WOOD_TALL_THRESHOLD ? WOOD_MIN_PROFILE_TALL : WOOD_MIN_PROFILE_SHORT;
    if (woodMin > min) {
      min = woodMin;
      reason = `Drewniana noga ${p.legHeightMm}mm wymaga min. ${min}mm przekroju (LEG-02)`;
    }
  }

  // LEG-03 — slenderness limit
  if (p.legHeightMm != null && (isMetal || isWood)) {
    const maxSlenderness = isWood ? MAX_SLENDERNESS_WOOD : MAX_SLENDERNESS_METAL;
    const slenderMin = Math.ceil(p.legHeightMm / maxSlenderness);
    if (slenderMin > min) {
      min = slenderMin;
      reason = `Smukłość λ ≤ ${maxSlenderness}: min. ${min}mm przy wysokości ${p.legHeightMm}mm (LEG-03)`;
    }
  }

  // STAB-02 — pedestal base diameter
  if ((p.legCount === 1 || p.legProfileType === 'pedestal') && p.totalHeightMm != null) {
    const pedestalMin = Math.ceil(PEDESTAL_BASE_RATIO * p.totalHeightMm);
    if (pedestalMin > min) {
      min = pedestalMin;
      reason = `Piedestał: min. ${pedestalMin}mm podstawy (≥ ${Math.round(PEDESTAL_BASE_RATIO * 100)}% wysokości ${p.totalHeightMm}mm)`;
    }
  }

  return { min, max: ABS.legProfile.max, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// legRadialSpreadMm
// ─────────────────────────────────────────────────────────────────────────────
function radialSpreadConstraint(p: Partial<TableConfig>) {
  let min = ABS.radialSpread.min;
  let reason = 'Minimalne rozpięcie półwalców';

  if (p.totalHeightMm != null) {
    const spreadMin = Math.ceil(RADIAL_SPREAD_RATIO * p.totalHeightMm);
    if (spreadMin > min) {
      min = spreadMin;
      reason = `Stateczność: min. ${min}mm promienia rozstawu (≥ ${Math.round(RADIAL_SPREAD_RATIO * 100)}% wysokości ${p.totalHeightMm}mm)`;
    }
  }

  return { min, max: ABS.radialSpread.max, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (mirrors logic in spanRules / suggester — same thresholds)
// ─────────────────────────────────────────────────────────────────────────────

/** Lowest thickness tier whose maxSpan × multiplier ≥ span. */
function minThicknessForSpan(material: string, span: number, mult: number): number | null {
  const tiers = SPAN_LIMITS_4LEG
    .filter(r => r.materials.includes(material))
    .sort((a, b) => a.minThicknessMm - b.minThicknessMm);

  for (const tier of tiers) {
    if (span <= tier.maxSpanMm * mult) return tier.minThicknessMm;
  }
  return null; // span exceeds all tiers
}

/** Highest maxSpan × multiplier for a given material and thickness. */
function maxSpanForThickness(material: string, thickness: number, mult: number): number | null {
  const tiers = SPAN_LIMITS_4LEG
    .filter(r => r.materials.includes(material))
    .sort((a, b) => b.minThicknessMm - a.minThicknessMm);

  const tier = tiers.find(r => thickness >= r.minThicknessMm);
  return tier ? Math.round(tier.maxSpanMm * mult) : null;
}

function recommendedThickness(
  material: string | undefined,
  length: number | undefined,
  atLeast: number,
): number {
  let rec = atLeast;
  if (!material) return Math.max(rec, 20);
  if (material === 'sintered_stone') {
    rec = Math.max(rec, length != null && length > 1200 ? 20 : 12);
  } else {
    rec = Math.max(rec, length != null && length > 1400 ? 30 : 20);
  }
  return rec;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label helpers (consistent with rule files)
// ─────────────────────────────────────────────────────────────────────────────
function ml(material: string): string {
  return ({ sintered_stone: 'Spiek', quartz: 'Kwarc', marble: 'Marmur', granite: 'Granit' } as Record<string, string>)[material] ?? material;
}

function edgeLabel(finish: string): string {
  return ({
    straight: 'prosta', beveled: 'skośna', rounded: 'zaokrąglona', mitered: 'ukosowana 45°',
  } as Record<string, string>)[finish] ?? finish;
}

function profileLabel(type: string): string {
  return ({
    round: 'okrągły', square: 'kwadratowy', rectangular: 'prostokątny',
    trestle: 'kozłowy', pedestal: 'piedestał',
  } as Record<string, string>)[type] ?? type;
}
