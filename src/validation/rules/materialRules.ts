import { TableConfig, ValidationMessage } from '../types';

// Minimum thickness per material — based on stone fabrication industry standards
// and flexural strength data for common slab thicknesses.
// Sources: Cosentino/Silestone tech specs, Italian stone association guidelines.

// [RULE-MAT-01] Minimum absolute thickness per material
const MATERIAL_MIN_THICKNESS: Record<string, number> = {
  sintered_stone: 12,   // spiek: 12mm is viable for structural use at short spans
  quartz:         20,   // kwarc: 20mm minimum due to lower flexural strength vs sintered
  marble:         20,   // marmur: 20mm — natural stone, brittle, prone to cracking
  granite:        20,   // granit: 20mm — similar to marble in brittleness profile
};

// [RULE-MAT-02] Increased minimum thickness for long spans (>1200mm / >1400mm)
// Deflection under load: δ = 5qL⁴/(384EI), I = bh³/12 — thicker = cube improvement
const MATERIAL_SPAN_UPGRADE: Array<{
  materials: string[];
  spanThresholdMm: number;
  minThicknessMm: number;
}> = [
  {
    // Sintered stone 12mm OK up to ~900mm span, 20mm needed above 1200mm
    materials: ['sintered_stone'],
    spanThresholdMm: 1200,
    minThicknessMm: 20,
  },
  {
    // Marble and granite: 30mm required above 1400mm span
    materials: ['marble', 'granite'],
    spanThresholdMm: 1400,
    minThicknessMm: 30,
  },
];

export function checkMaterialThickness(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];

  // For composite tops, face thickness rules (COMP-01) govern minimum thickness — skip MAT-01/02.
  if (config.topConstruction === 'composite') return violations;

  const { topMaterial, topThicknessMm, topLengthMm } = config;

  // [RULE-MAT-01] Absolute minimum thickness
  const absMin = MATERIAL_MIN_THICKNESS[topMaterial];
  if (topThicknessMm < absMin) {
    violations.push({
      ruleId: 'MAT-01',
      field: 'topThicknessMm',
      messagepl: `Minimalna grubość blatu z materiału "${materialLabel(topMaterial)}" wynosi ${absMin}mm. Podana grubość ${topThicknessMm}mm jest niewystarczająca.`,
      messageTech: `Material ${topMaterial} requires min ${absMin}mm thickness, got ${topThicknessMm}mm.`,
    });
  }

  // [RULE-MAT-02] Span-based thickness upgrade
  for (const rule of MATERIAL_SPAN_UPGRADE) {
    if (
      rule.materials.includes(topMaterial) &&
      topLengthMm > rule.spanThresholdMm &&
      topThicknessMm < rule.minThicknessMm
    ) {
      violations.push({
        ruleId: 'MAT-02',
        field: 'topThicknessMm',
        messagepl: `Przy wymiarze blatu ${topLengthMm}mm materiał "${materialLabel(topMaterial)}" wymaga grubości co najmniej ${rule.minThicknessMm}mm (podano ${topThicknessMm}mm). Przy dużej rozpiętości cieńszy blat jest podatny na ugięcie i pęknięcia.`,
        messageTech: `${topMaterial} at span ${topLengthMm}mm (>${rule.spanThresholdMm}mm) requires ${rule.minThicknessMm}mm thickness, got ${topThicknessMm}mm.`,
      });
    }
  }

  return violations;
}

function materialLabel(material: string): string {
  const labels: Record<string, string> = {
    sintered_stone: 'spiek kwarcowy',
    quartz: 'kwarc',
    marble: 'marmur',
    granite: 'granit',
  };
  return labels[material] ?? material;
}
