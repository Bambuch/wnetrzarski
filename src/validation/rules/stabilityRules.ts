import { TableConfig, ValidationMessage } from '../types';

// Stability (stateczność) rules — ensure the table won't tip over under lateral load.
// Based on static equilibrium: tipping moment M_tip = F_lateral × h,
// restoring moment M_restore = W × (footprint/2).
// Simplified stability criterion: footprint / height ≥ 0.45
// (conservative for domestic furniture, origin: furniture stability EN 1730 approximation)

// [RULE-STAB-01] Stability ratio: footprint width / totalHeight >= 0.45
const MIN_STABILITY_RATIO = 0.45;

// [RULE-STAB-02] Pedestal base: base diameter >= 0.4 × totalHeight
const PEDESTAL_BASE_RATIO = 0.4;

// [RULE-STAB-03] Foot base required for tall thin legs
// Prevents overturning and floor damage; common in high-end furniture manufacturing.
const FOOT_BASE_RULES = {
  metal: { maxLegHeightWithoutBase: 700, minProfileForNoBase: 60 },
  wood:  { maxLegHeightWithoutBase: 700, minProfileForNoBase: 80 },
};

const METAL_MATERIALS = new Set(['steel', 'stainless_steel', 'aluminum']);
const WOOD_MATERIALS  = new Set(['solid_wood', 'laminated_wood']);

export function checkStability(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];
  const {
    topWidthMm,
    totalHeightMm,
    legCount,
    legProfileType,
    legProfileSizeMm,
    legHeightMm,
    legMaterial,
    hasFootBase,
  } = config;

  const isRadial = legProfileType === 'radial_halfcylinder';

  // [RULE-STAB-01] General stability ratio
  // For radial bases, the effective footprint = legRadialSpreadMm × 2 (diameter of spread circle).
  // For all other types, use topWidthMm (conservative: narrower dimension is worst case).
  const footprint = isRadial && config.legRadialSpreadMm != null
    ? config.legRadialSpreadMm * 2
    : topWidthMm;

  const stabilityRatio = footprint / totalHeightMm;
  if (stabilityRatio < MIN_STABILITY_RATIO) {
    const minFootprint = Math.ceil(MIN_STABILITY_RATIO * totalHeightMm);
    violations.push({
      ruleId: 'STAB-01',
      field: 'topWidthMm',
      messagepl: `Stosunek rzutu poziomego (${footprint}mm) do całkowitej wysokości stołu (${totalHeightMm}mm) wynosi ${stabilityRatio.toFixed(2)}, co jest poniżej minimalnego progu ${MIN_STABILITY_RATIO}. Stół może być niestabilny. Minimalne rozpięcie przy tej wysokości to ${minFootprint}mm.`,
      messageTech: `Stability ratio ${stabilityRatio.toFixed(3)} < ${MIN_STABILITY_RATIO}. footprint=${footprint}mm, height=${totalHeightMm}mm. Min footprint: ${minFootprint}mm.`,
    });
  }

  // [RULE-STAB-02] Pedestal base diameter — not applicable to radial halfcylinder bases
  if (!isRadial && (legCount === 1 || legProfileType === 'pedestal')) {
    const minBase = Math.ceil(PEDESTAL_BASE_RATIO * totalHeightMm);
    if (legProfileSizeMm < minBase) {
      violations.push({
        ruleId: 'STAB-02',
        field: 'legProfileSizeMm',
        messagepl: `Podstawa piedestału ma średnicę ${legProfileSizeMm}mm, ale przy wysokości stołu ${totalHeightMm}mm minimalna średnica podstawy wynosi ${minBase}mm (co najmniej 40% wysokości). Stół może się przewrócić.`,
        messageTech: `Pedestal base ${legProfileSizeMm}mm < required ${minBase}mm (0.4 × ${totalHeightMm}mm = ${minBase}mm).`,
      });
    }
  }

  // [RULE-STAB-03] Foot base requirement for tall thin legs — not applicable to radial bases
  if (!isRadial) {
    const isMetalLeg = METAL_MATERIALS.has(legMaterial);
    const isWoodLeg  = WOOD_MATERIALS.has(legMaterial);

    if (isMetalLeg) {
      const rule = FOOT_BASE_RULES.metal;
      if (legHeightMm > rule.maxLegHeightWithoutBase && legProfileSizeMm < rule.minProfileForNoBase && !hasFootBase) {
        violations.push({
          ruleId: 'STAB-03',
          field: 'hasFootBase',
          messagepl: `Metalowa noga o wysokości ${legHeightMm}mm i przekroju ${legProfileSizeMm}mm wymaga stopy stabilizującej (hasFootBase). Nogi powyżej ${rule.maxLegHeightWithoutBase}mm z profilem poniżej ${rule.minProfileForNoBase}mm są podatne na przewrócenie.`,
          messageTech: `Metal leg h=${legHeightMm}mm > ${rule.maxLegHeightWithoutBase}mm and profile ${legProfileSizeMm}mm < ${rule.minProfileForNoBase}mm — foot base required.`,
        });
      }
    }

    if (isWoodLeg) {
      const rule = FOOT_BASE_RULES.wood;
      if (legHeightMm > rule.maxLegHeightWithoutBase && legProfileSizeMm < rule.minProfileForNoBase && !hasFootBase) {
        violations.push({
          ruleId: 'STAB-03',
          field: 'hasFootBase',
          messagepl: `Drewniana noga o wysokości ${legHeightMm}mm i przekroju ${legProfileSizeMm}mm wymaga stopy stabilizującej. Nogi drewniane powyżej ${rule.maxLegHeightWithoutBase}mm z wymiarem poniżej ${rule.minProfileForNoBase}mm są niestabilne bez stopy.`,
          messageTech: `Wood leg h=${legHeightMm}mm > ${rule.maxLegHeightWithoutBase}mm and profile ${legProfileSizeMm}mm < ${rule.minProfileForNoBase}mm — foot base required.`,
        });
      }
    }
  }

  return violations;
}
