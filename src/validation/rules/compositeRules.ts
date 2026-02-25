import { TableConfig, ValidationMessage } from '../types';

// Rules for composite top construction (two face panels + internal core).
// Composite tops allow thinner overall slabs without using solid stone throughout —
// e.g. 45mm total with 2×6mm faces and 33mm core.  Common in high-design furniture.

// [RULE-COMP-01] Minimum face panel thickness per material
// Sintered stone can go to 6mm due to high flexural strength; natural stones need 12mm.
const COMPOSITE_FACE_MIN: Record<string, number> = {
  sintered_stone: 6,
  quartz:         12,
  marble:         12,
  granite:        12,
};

// [RULE-COMP-02 / COMP-03] Minimum core thickness
// Below 10mm the core cannot be reliably bonded and provides no structural benefit.
const MIN_CORE_MM = 10;

export function checkCompositeTop(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];

  if (config.topConstruction !== 'composite') return violations;

  const { topMaterial, topThicknessMm, topFaceThicknessMm } = config;

  if (topFaceThicknessMm === undefined) return violations; // face thickness required; caught by form validation

  // [RULE-COMP-01] Minimum face thickness per material
  const faceMin = COMPOSITE_FACE_MIN[topMaterial];
  if (faceMin !== undefined && topFaceThicknessMm < faceMin) {
    violations.push({
      ruleId: 'COMP-01',
      field: 'topFaceThicknessMm',
      messagepl: `Minimalna grubość tafli blatu kompozytowego z materiału "${materialLabel(topMaterial)}" wynosi ${faceMin}mm. Podana grubość tafli ${topFaceThicknessMm}mm jest niewystarczająca.`,
      messageTech: `Composite face min thickness for ${topMaterial} is ${faceMin}mm, got ${topFaceThicknessMm}mm.`,
    });
  }

  const core = topThicknessMm - 2 * topFaceThicknessMm;

  // [RULE-COMP-02] Core must be at least MIN_CORE_MM
  if (core < MIN_CORE_MM) {
    violations.push({
      ruleId: 'COMP-02',
      field: 'topFaceThicknessMm',
      messagepl: `Rdzeń blatu kompozytowego (${topThicknessMm}mm − 2×${topFaceThicknessMm}mm = ${core}mm) jest zbyt cienki. Minimalna grubość rdzenia wynosi ${MIN_CORE_MM}mm.`,
      messageTech: `Composite core ${core}mm (${topThicknessMm} - 2×${topFaceThicknessMm}) < min ${MIN_CORE_MM}mm.`,
    });
  }

  // [RULE-COMP-03] Consistency: total >= 2×face + MIN_CORE (same condition as COMP-02, different field)
  const minTotal = 2 * topFaceThicknessMm + MIN_CORE_MM;
  if (topThicknessMm < minTotal && core >= MIN_CORE_MM) {
    // This branch covers the edge case where total is stated too low independently of face thickness.
    // When COMP-02 already fires, skip to avoid redundancy.
    violations.push({
      ruleId: 'COMP-03',
      field: 'topThicknessMm',
      messagepl: `Całkowita grubość blatu kompozytowego (${topThicknessMm}mm) jest niewystarczająca. Przy grubości tafli ${topFaceThicknessMm}mm minimalna całkowita grubość to ${minTotal}mm (2×tafla + ${MIN_CORE_MM}mm rdzeń).`,
      messageTech: `Composite total ${topThicknessMm}mm < required ${minTotal}mm (2×${topFaceThicknessMm} + ${MIN_CORE_MM}).`,
    });
  }

  return violations;
}

function materialLabel(material: string): string {
  const labels: Record<string, string> = {
    sintered_stone: 'spiek kwarcowy',
    quartz:         'kwarc',
    marble:         'marmur',
    granite:        'granit',
  };
  return labels[material] ?? material;
}
