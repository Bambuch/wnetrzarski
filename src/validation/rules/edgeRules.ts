import { TableConfig, ValidationMessage } from '../types';

// Edge finish compatibility rules.
// Mitered and beveled edges require material removal at the edge — minimum thickness
// ensures enough material remains after machining and that the edge doesn't chip.
// [RULE-EDGE-01] Mitered edge: requires >= 20mm (enough stock for a clean 45° cut through full depth)
// [RULE-EDGE-02] Beveled edge: requires >= 12mm (shallow angle, less material removed)

export const EDGE_MIN_THICKNESS: Record<string, number> = {
  mitered: 20,
  beveled: 12,
};

export function checkEdge(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];
  const { topEdgeFinish, topThicknessMm } = config;

  // For composite tops the edge is machined on the face panel only — check face thickness.
  const effectiveThickness =
    config.topConstruction === 'composite' && config.topFaceThicknessMm != null
      ? config.topFaceThicknessMm
      : topThicknessMm;

  const minThickness = EDGE_MIN_THICKNESS[topEdgeFinish];

  if (minThickness !== undefined && effectiveThickness < minThickness) {
    const ruleId = topEdgeFinish === 'mitered' ? 'EDGE-01' : 'EDGE-02';
    violations.push({
      ruleId,
      field: 'topEdgeFinish',
      messagepl: `Wykończenie krawędzi "${edgeLabel(topEdgeFinish)}" wymaga grubości tafli co najmniej ${minThickness}mm. Przy grubości tafli ${effectiveThickness}mm nie ma wystarczającego materiału do prawidłowej obróbki krawędzi.`,
      messageTech: `Edge finish "${topEdgeFinish}" requires min thickness ${minThickness}mm, got ${effectiveThickness}mm (${config.topConstruction === 'composite' ? 'face panel' : 'top'}).`,
    });
  }

  return violations;
}

function edgeLabel(finish: string): string {
  const labels: Record<string, string> = {
    straight: 'prosta',
    beveled: 'skośna (bevel)',
    rounded: 'zaokrąglona',
    mitered: 'ukosowana (miter 45°)',
  };
  return labels[finish] ?? finish;
}
