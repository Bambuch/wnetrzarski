import { validate } from '../validation/engine';
import { TableConfig } from '../validation/types';

// Helper: base valid config (standard dining table 1800×900, 20mm sintered stone, 4 steel legs)
function base(): TableConfig {
  return {
    topMaterial:      'sintered_stone',
    topThicknessMm:   20,
    topShapeType:     'rectangle',
    topLengthMm:      1800,
    topWidthMm:       900,
    topEdgeFinish:    'straight',
    legCount:         4,
    legMaterial:      'steel',
    legProfileType:   'square',
    legProfileSizeMm: 60,
    legHeightMm:      700,
    hasFootBase:      false,
    totalHeightMm:    720,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Valid standard dining table
// ─────────────────────────────────────────────────────────────────────────────
test('TC-01: Valid standard dining table (1800×900, 20mm sintered, 4 legs, 720mm height)', () => {
  const result = validate(base());
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
  expect(result.suggestedConfig).toBeUndefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Too thin top for span — 12mm sintered, 1600mm span
// ─────────────────────────────────────────────────────────────────────────────
test('TC-02: Too thin top for span (1600×800, 12mm sintered) → suggest 20mm', () => {
  const config: TableConfig = {
    ...base(),
    topThicknessMm: 12,
    topLengthMm:    1600,
    topWidthMm:     800,
    legHeightMm:    688,
    totalHeightMm:  700,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const spanViolation = result.violations.find(v => v.ruleId === 'SPAN-01');
  expect(spanViolation).toBeDefined();

  // Suggestion must increase thickness
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.topThicknessMm).toBeGreaterThanOrEqual(20);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Unstable pedestal — 1200mm round top, single leg 50mm, 750mm height
// ─────────────────────────────────────────────────────────────────────────────
test('TC-03: Unstable pedestal (round 1200mm top, 50mm leg, 750mm height)', () => {
  const config: TableConfig = {
    ...base(),
    topShapeType:     'round',
    topLengthMm:      1200,
    topWidthMm:       1200,
    legCount:         1,
    legProfileType:   'pedestal',
    legProfileSizeMm: 50,
    legHeightMm:      730,
    totalHeightMm:    750,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  // Should have STAB-02 (pedestal base too small) and/or SPAN-02 (diagonal too large)
  const ruleIds = result.violations.map(v => v.ruleId);
  expect(ruleIds.some(id => ['STAB-02', 'SPAN-02'].includes(id))).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Wood leg too slender — 900mm height, 50mm square solid_wood
// ─────────────────────────────────────────────────────────────────────────────
test('TC-04: Wood leg too slender (900mm height, 50mm square solid_wood)', () => {
  const config: TableConfig = {
    ...base(),
    legMaterial:      'solid_wood',
    legProfileType:   'square',
    legProfileSizeMm: 50,
    legHeightMm:      880,
    totalHeightMm:    900,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  // LEG-02 (wood min profile) and/or LEG-03 (slenderness)
  const ruleIds = result.violations.map(v => v.ruleId);
  expect(ruleIds.some(id => ['LEG-02', 'LEG-03'].includes(id))).toBe(true);

  // Suggested profile must fix slenderness: 880/15 ≈ 59 → at least 60mm for wood
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.legProfileSizeMm).toBeGreaterThanOrEqual(60);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Mitered edge on 12mm top → suggest 20mm
// ─────────────────────────────────────────────────────────────────────────────
test('TC-05: Mitered edge on 12mm top → suggest 20mm', () => {
  const config: TableConfig = {
    ...base(),
    topThicknessMm: 12,
    topEdgeFinish:  'mitered',
    legHeightMm:    688,
    totalHeightMm:  700,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const edgeViolation = result.violations.find(v => v.ruleId === 'EDGE-01');
  expect(edgeViolation).toBeDefined();

  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.topThicknessMm).toBeGreaterThanOrEqual(20);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: Total height mismatch
// ─────────────────────────────────────────────────────────────────────────────
test('TC-06: Total height mismatch (legHeight + topThickness ≠ totalHeight)', () => {
  const config: TableConfig = {
    ...base(),
    legHeightMm:   700,
    topThicknessMm: 20,
    totalHeightMm:  750, // should be 720
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const hgtViolation = result.violations.find(v => v.ruleId === 'HGT-03');
  expect(hgtViolation).toBeDefined();

  // Suggested config should fix the total height
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.totalHeightMm).toBe(720);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: Single pedestal leg on rectangular top
// ─────────────────────────────────────────────────────────────────────────────
test('TC-07: Single pedestal leg on rectangular top → violation LEG-04', () => {
  const config: TableConfig = {
    ...base(),
    topShapeType:   'rectangle',
    legCount:       1,
    legProfileType: 'pedestal',
    legProfileSizeMm: 200,
    legHeightMm:    700,
    totalHeightMm:  720,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const legViolation = result.violations.find(v => v.ruleId === 'LEG-04');
  expect(legViolation).toBeDefined();

  // Suggested config: legCount should become 4
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.legCount).toBe(4);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: Bar table check — 6mm sintered stone is below material minimum
// ─────────────────────────────────────────────────────────────────────────────
test('TC-08: Bar table 1000mm height, 6mm sintered → MAT-01 violation', () => {
  const config: TableConfig = {
    ...base(),
    topThicknessMm: 6,
    legHeightMm:    994,
    totalHeightMm:  1000,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const matViolation = result.violations.find(v => v.ruleId === 'MAT-01');
  expect(matViolation).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: Missing foot base on tall thin metal leg
// ─────────────────────────────────────────────────────────────────────────────
test('TC-09: Missing foot base on tall thin metal leg → STAB-03, suggest hasFootBase=true', () => {
  const config: TableConfig = {
    ...base(),
    legMaterial:      'steel',
    legProfileSizeMm: 40,       // below 60mm threshold for metal
    legHeightMm:      760,      // above 700mm threshold
    hasFootBase:      false,
    totalHeightMm:    780,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const footViolation = result.violations.find(v => v.ruleId === 'STAB-03');
  expect(footViolation).toBeDefined();

  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.hasFootBase).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: Marble top 1500×800 at 20mm → suggest 30mm (MAT-02)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-10: Marble top 1500×800 at 20mm → suggest 30mm (MAT-02)', () => {
  const config: TableConfig = {
    ...base(),
    topMaterial:    'marble',
    topThicknessMm: 20,
    topLengthMm:    1500,
    topWidthMm:     800,
    legHeightMm:    700,
    totalHeightMm:  720,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const matViolation = result.violations.find(v => v.ruleId === 'MAT-02');
  expect(matViolation).toBeDefined();

  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.topThicknessMm).toBeGreaterThanOrEqual(30);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 11: Valid round table with pedestal (900mm diameter, 30mm sintered, 750mm)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-11: Valid round table with pedestal (900mm, 30mm sintered, 750mm height)', () => {
  const config: TableConfig = {
    ...base(),
    topMaterial:      'sintered_stone',
    topThicknessMm:   30,
    topShapeType:     'round',
    topLengthMm:      900,
    topWidthMm:       900,
    topEdgeFinish:    'straight',
    legCount:         1,
    legProfileType:   'pedestal',
    legProfileSizeMm: 300,   // >= 0.4 × 750 = 300mm ✓
    legHeightMm:      720,
    hasFootBase:      false,
    totalHeightMm:    750,
  };
  const result = validate(config);
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 12: Aluminum rectangular leg within slenderness limits
// ─────────────────────────────────────────────────────────────────────────────
test('TC-12: Aluminum rectangular leg within slenderness limits → valid', () => {
  const config: TableConfig = {
    ...base(),
    legMaterial:      'aluminum',
    legProfileType:   'rectangular',
    legProfileSizeMm: 60,
    legProfileWidthMm: 40,
    legHeightMm:      700,   // slenderness = 700/60 ≈ 11.7 < 25 ✓
    totalHeightMm:    720,
  };
  const result = validate(config);
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 13: Beveled edge on 6mm top → EDGE-02 violation
// ─────────────────────────────────────────────────────────────────────────────
test('TC-13: Beveled edge on 6mm top → EDGE-02 violation', () => {
  const config: TableConfig = {
    ...base(),
    topThicknessMm: 6,
    topEdgeFinish:  'beveled',
    legHeightMm:    714,
    totalHeightMm:  720,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const edgeViolation = result.violations.find(v => v.ruleId === 'EDGE-02');
  expect(edgeViolation).toBeDefined();

  // Suggested: switch to 'straight' (because 6mm is below material min of 12mm too)
  expect(result.suggestedConfig).toBeDefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 14: 4-leg oval top → warning LEG-05 only, not a violation
// ─────────────────────────────────────────────────────────────────────────────
test('TC-14: 4-leg oval top → warning only (LEG-05), isValid=true', () => {
  const config: TableConfig = {
    ...base(),
    topShapeType: 'oval',
    legCount:     4,
  };
  const result = validate(config);

  // Should have the warning
  const warning = result.warnings.find(w => w.ruleId === 'LEG-05');
  expect(warning).toBeDefined();

  // Must still be valid (no violations)
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 15: Valid coffee table (450mm height, 20mm quartz, 4 legs, 1200×600)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-15: Valid coffee table (450mm height, 20mm quartz, 4 legs, 1200×600)', () => {
  const config: TableConfig = {
    topMaterial:      'quartz',
    topThicknessMm:   20,
    topShapeType:     'rectangle',
    topLengthMm:      1200,
    topWidthMm:       600,
    topEdgeFinish:    'rounded',
    legCount:         4,
    legMaterial:      'steel',
    legProfileType:   'square',
    legProfileSizeMm: 50,
    legHeightMm:      430,
    hasFootBase:      false,
    totalHeightMm:    450,
  };
  const result = validate(config);
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 16: Composite top 45mm (2×6mm sintered, core 33mm), 4 steel legs → valid
// ─────────────────────────────────────────────────────────────────────────────
test('TC-16: Composite top 45mm (2×6mm sintered, core 33mm), 4 steel legs → valid', () => {
  const config: TableConfig = {
    ...base(),
    topConstruction:    'composite',
    topMaterial:        'sintered_stone',
    topThicknessMm:     45,
    topFaceThicknessMm: 6,
    legCount:           4,
    legHeightMm:        700,
    totalHeightMm:      745,   // 700 + 45
  };
  const result = validate(config);
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
  expect(result.suggestedConfig).toBeUndefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 17: Composite top — face panel too thin (2×4mm quartz, total 30mm) → COMP-01
// ─────────────────────────────────────────────────────────────────────────────
test('TC-17: Composite top — face panel too thin (2×4mm quartz, total 30mm) → COMP-01', () => {
  const config: TableConfig = {
    ...base(),
    topConstruction:    'composite',
    topMaterial:        'quartz',
    topThicknessMm:     30,
    topFaceThicknessMm: 4,     // quartz minimum is 12mm
    legHeightMm:        700,
    totalHeightMm:      730,   // 700 + 30
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const compViolation = result.violations.find(v => v.ruleId === 'COMP-01');
  expect(compViolation).toBeDefined();

  // MAT-01/MAT-02 must NOT fire for composite tops
  expect(result.violations.some(v => v.ruleId === 'MAT-01')).toBe(false);
  expect(result.violations.some(v => v.ruleId === 'MAT-02')).toBe(false);

  // Suggestion must bump face thickness to at least 12mm (quartz min)
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.topFaceThicknessMm).toBeGreaterThanOrEqual(12);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 18: Radial halfcylinder base — 4 halfcylinders, spread=350mm, 750mm total → valid
// ─────────────────────────────────────────────────────────────────────────────
test('TC-18: Radial base (4 halfcylinders, spread=350mm, 750mm height) → valid', () => {
  const config: TableConfig = {
    ...base(),
    legProfileType:    'radial_halfcylinder',
    legRadialCount:    4,
    legRadialSpreadMm: 350,
    legProfileSizeMm:  80,    // >= 60mm (RADIAL-03)
    legCount:          1,
    legHeightMm:       730,
    totalHeightMm:     750,   // 730 + 20
  };
  const result = validate(config);
  expect(result.isValid).toBe(true);
  expect(result.violations).toHaveLength(0);
  expect(result.suggestedConfig).toBeUndefined();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 19: Radial base — spread too small (spread=200mm, 750mm height) → RADIAL-01
// ─────────────────────────────────────────────────────────────────────────────
test('TC-19: Radial base — spread too small (spread=200mm, 750mm height) → RADIAL-01', () => {
  const config: TableConfig = {
    ...base(),
    legProfileType:    'radial_halfcylinder',
    legRadialCount:    4,
    legRadialSpreadMm: 200,   // < 0.4 × 750 = 300mm
    legProfileSizeMm:  80,
    legCount:          1,
    legHeightMm:       730,
    totalHeightMm:     750,
  };
  const result = validate(config);
  expect(result.isValid).toBe(false);

  const radialViolation = result.violations.find(v => v.ruleId === 'RADIAL-01');
  expect(radialViolation).toBeDefined();

  // Suggestion must increase spread to at least 300mm (0.4 × 750)
  expect(result.suggestedConfig).toBeDefined();
  expect(result.suggestedConfig!.legRadialSpreadMm).toBeGreaterThanOrEqual(300);
});
