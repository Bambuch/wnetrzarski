import { TableConfig, ValidationResult, ValidationMessage } from './types';
import { checkCompositeTop } from './rules/compositeRules';
import { checkMaterialThickness } from './rules/materialRules';
import { checkSpan } from './rules/spanRules';
import { checkStability } from './rules/stabilityRules';
import { checkLegRules } from './rules/legRules';
import { checkHeight } from './rules/heightRules';
import { checkEdge } from './rules/edgeRules';
import { generateSuggestion } from './suggester';

// Severity separator: LEG-05 is a warning, everything else is a violation.
const WARNING_RULE_IDS = new Set(['LEG-05']);

/**
 * Main validation entrypoint.
 * Runs all rule modules in sequence, collects violations and warnings,
 * and generates a nearest-valid suggested config when invalid.
 */
export function validate(config: TableConfig): ValidationResult {
  const allMessages: ValidationMessage[] = [
    ...checkCompositeTop(config),
    ...checkMaterialThickness(config),
    ...checkSpan(config),
    ...checkStability(config),
    ...checkLegRules(config),
    ...checkHeight(config),
    ...checkEdge(config),
  ];

  const violations = allMessages.filter(m => !WARNING_RULE_IDS.has(m.ruleId));
  const warnings   = allMessages.filter(m =>  WARNING_RULE_IDS.has(m.ruleId));

  const isValid = violations.length === 0;

  const result: ValidationResult = {
    isValid,
    warnings,
    violations,
  };

  if (!isValid) {
    result.suggestedConfig = generateSuggestion(config, violations);
  }

  return result;
}
