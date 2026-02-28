import { TableConfig, ValidationMessage } from '../types';

// Maximum unsupported span rules for stone tops.
// Derived from flexural strength of stone slabs and standard fabrication practice.
// For 4-leg tables, legs are typically set in ~100mm from each edge; the effective
// unsupported span is therefore ≈ topLength − 200mm. We use topLengthMm directly
// as a conservative worst-case, but limits reflect real-world manufacturer specs
// (e.g. Dekton/Laminam 20mm rated to full 1800mm table lengths with apron support).
// Rule of thumb: max span ≈ 90 × thickness for sintered stone in framed construction.

// [RULE-SPAN-01] Max span between legs for 4-leg / 2-leg / 6-leg setup
// Limits reflect maximum supported table LENGTH (not clear span) per manufacturer specs.
export const SPAN_LIMITS_4LEG: Array<{
  materials: string[];
  minThicknessMm: number;
  maxSpanMm: number;
}> = [
  { materials: ['sintered_stone'],                                          minThicknessMm: 12, maxSpanMm: 900 },
  { materials: ['sintered_stone'],                                          minThicknessMm: 20, maxSpanMm: 1800 },
  { materials: ['quartz', 'marble', 'granite'],                            minThicknessMm: 20, maxSpanMm: 1400 },
  { materials: ['sintered_stone', 'quartz', 'marble', 'granite'],          minThicknessMm: 30, maxSpanMm: 2400 },
];

// [RULE-SPAN-02] Pedestal (single central leg) — max top diagonal
export const PEDESTAL_SPAN_LIMITS: Array<{
  minThicknessMm: number;
  maxDiagonalMm: number;
}> = [
  { minThicknessMm: 20, maxDiagonalMm: 1000 },
  { minThicknessMm: 30, maxDiagonalMm: 1200 },
];

export function checkSpan(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];
  const {
    topMaterial,
    topThicknessMm,
    topShapeType,
    topLengthMm,
    topWidthMm,
    legCount,
    legProfileType,
  } = config;

  // For a round top the critical span is the diameter, not the diagonal of a bounding square.
  // For all other shapes we use the longest diagonal as the worst-case span.
  const effectiveSpan =
    topShapeType === 'round'
      ? topLengthMm
      : Math.sqrt(topLengthMm ** 2 + topWidthMm ** 2);

  // Composite sandwich tops are stiffer than solid stone — allow 1.4× higher span limits.
  const compositeMultiplier = config.topConstruction === 'composite' ? 1.4 : 1.0;

  // [RULE-SPAN-02] Pedestal check (single leg, legCount === 1)
  // Radial halfcylinder base is not a pedestal — skip pedestal span check for it.
  if ((legCount === 1 || legProfileType === 'pedestal') && legProfileType !== 'radial_halfcylinder') {
    const limit = [...PEDESTAL_SPAN_LIMITS]
      .reverse()
      .find(l => topThicknessMm >= l.minThicknessMm);

    const maxDiag = limit?.maxDiagonalMm ?? 800; // below 20mm — very conservative

    if (effectiveSpan > maxDiag) {
      violations.push({
        ruleId: 'SPAN-02',
        field: 'topLengthMm',
        messagepl: `Pojedyncza noga centralna (piedestał) nie udźwignie blatu o rozpiętości ${Math.round(effectiveSpan)}mm. Przy grubości ${topThicknessMm}mm maksymalna rozpiętość wynosi ${maxDiag}mm. Zwiększ grubość blatu lub zastosuj więcej nóg.`,
        messageTech: `Pedestal leg: top span ${Math.round(effectiveSpan)}mm exceeds max ${maxDiag}mm for ${topThicknessMm}mm ${topMaterial}.`,
      });
    }
    return violations; // pedestal rules are standalone
  }

  // [RULE-SPAN-01] 4-leg / 2-leg / 6-leg support
  if (legCount === 2 || legCount === 4 || legCount === 6) {
    // Span measured as the top's longest dimension (length for rectangular tops).
    const span = topLengthMm;

    // Find the best applicable rule: highest thickness tier that matches material AND thickness
    const applicableRule = [...SPAN_LIMITS_4LEG]
      .filter(r => r.materials.includes(topMaterial))
      .sort((a, b) => b.minThicknessMm - a.minThicknessMm)
      .find(r => topThicknessMm >= r.minThicknessMm);

    // Only generate a violation when a rule exists AND the span exceeds it.
    // Composite tops get a 1.4× stiffness bonus on the span limit.
    // If no rule exists for this material/thickness combo, we have no defined limit → no violation.
    const effectiveMaxSpan = applicableRule ? applicableRule.maxSpanMm * compositeMultiplier : Infinity;
    if (applicableRule && span > effectiveMaxSpan) {
      violations.push({
        ruleId: 'SPAN-01',
        field: 'topLengthMm',
        messagepl: `Przy grubości blatu ${topThicknessMm}mm i materiale "${materialLabel(topMaterial)}" maksymalna długość stołu wynosi ${applicableRule.maxSpanMm}mm. Wymiar ${span}mm przekracza ten limit. Zwiększ grubość blatu lub zmniejsz wymiary blatu.`,
        messageTech: `${topMaterial} at ${topThicknessMm}mm has max span ${applicableRule.maxSpanMm}mm (effective ${Math.round(effectiveMaxSpan)}mm with composite multiplier), table length ${span}mm exceeds it.`,
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
