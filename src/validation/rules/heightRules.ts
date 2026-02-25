import { TableConfig, ValidationMessage } from '../types';

// Height rules for table configurations.
// Standard ergonomic heights per EN 1730 / ISO 7174 / common industry ranges.

// [RULE-HGT-01] Total height physical limits
// Coffee tables: 350–500mm, dining: 720–760mm, bar: 900–1100mm
const MIN_TOTAL_HEIGHT = 350;  // mm — allows coffee tables (~400–500mm) and low side tables
const MAX_TOTAL_HEIGHT = 1100; // mm — bar / standing table upper bound

// [RULE-HGT-02] Standard dining table range (informational, not hard stop)
const DINING_TABLE_MIN = 720; // mm
const DINING_TABLE_MAX = 760; // mm

// [RULE-HGT-03] totalHeightMm must equal legHeightMm + topThicknessMm (±2mm tolerance)
const HEIGHT_TOLERANCE = 2; // mm

export function checkHeight(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];

  const { totalHeightMm, legHeightMm, topThicknessMm } = config;

  // [RULE-HGT-01] Absolute height limits
  if (totalHeightMm < MIN_TOTAL_HEIGHT) {
    violations.push({
      ruleId: 'HGT-01',
      field: 'totalHeightMm',
      messagepl: `Całkowita wysokość stołu ${totalHeightMm}mm jest poniżej minimalnego dopuszczalnego limitu ${MIN_TOTAL_HEIGHT}mm.`,
      messageTech: `totalHeight ${totalHeightMm}mm below minimum ${MIN_TOTAL_HEIGHT}mm.`,
    });
  }

  if (totalHeightMm > MAX_TOTAL_HEIGHT) {
    violations.push({
      ruleId: 'HGT-01',
      field: 'totalHeightMm',
      messagepl: `Całkowita wysokość stołu ${totalHeightMm}mm przekracza maksymalny dopuszczalny limit ${MAX_TOTAL_HEIGHT}mm (stoły barowe).`,
      messageTech: `totalHeight ${totalHeightMm}mm above maximum ${MAX_TOTAL_HEIGHT}mm.`,
    });
  }

  // [RULE-HGT-03] Consistency check: totalHeight = legHeight + topThickness ± tolerance
  const expectedTotal = legHeightMm + topThicknessMm;
  const diff = Math.abs(totalHeightMm - expectedTotal);
  if (diff > HEIGHT_TOLERANCE) {
    violations.push({
      ruleId: 'HGT-03',
      field: 'totalHeightMm',
      messagepl: `Wysokość całkowita (${totalHeightMm}mm) nie zgadza się z sumą nogi (${legHeightMm}mm) + grubości blatu (${topThicknessMm}mm) = ${expectedTotal}mm. Różnica wynosi ${diff}mm (tolerancja: ±${HEIGHT_TOLERANCE}mm).`,
      messageTech: `totalHeight ${totalHeightMm}mm ≠ legHeight ${legHeightMm}mm + topThickness ${topThicknessMm}mm = ${expectedTotal}mm (diff=${diff}mm, tolerance=${HEIGHT_TOLERANCE}mm).`,
    });
  }

  return violations;
}
