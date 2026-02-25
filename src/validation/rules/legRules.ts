import { TableConfig, ValidationMessage } from '../types';

// Leg profile dimension and slenderness rules.
// Slenderness ratio λ = legHeight / radius_of_gyration (simplified as legHeight / profileSize).
// Beyond a critical slenderness, legs are susceptible to Euler column buckling.
// Metal (steel/aluminum): λ_max ≈ 25 (conservative for hollow sections)
// Wood: λ_max ≈ 15 (solid wood, lower E-modulus and orthotropic properties)

// [RULE-LEG-01] Minimum profile dimensions per material/profile type
// Based on standard furniture leg stock sizes and structural adequacy.
const LEG_MIN_PROFILES: Array<{
  materials: string[];
  profileType: string;
  minSizeMm: number;
  note: string;
}> = [
  { materials: ['steel', 'stainless_steel', 'aluminum'], profileType: 'round',     minSizeMm: 30, note: 'round metal leg min 30mm diameter' },
  { materials: ['steel', 'stainless_steel', 'aluminum'], profileType: 'square',    minSizeMm: 40, note: 'square metal leg min 40mm side' },
  { materials: ['steel', 'stainless_steel', 'aluminum'], profileType: 'rectangular', minSizeMm: 40, note: 'rectangular metal leg min 40mm smaller side' },
];

// [RULE-LEG-02] Wood leg minimum size — depends on height
const WOOD_MIN_PROFILE_SHORT = 60;  // mm, for legHeight < 750mm
const WOOD_MIN_PROFILE_TALL  = 80;  // mm, for legHeight >= 750mm
const WOOD_TALL_THRESHOLD    = 750; // mm

// [RULE-LEG-03] Slenderness ratio limits
// λ = legHeightMm / legProfileSizeMm
const MAX_SLENDERNESS_METAL = 25;
const MAX_SLENDERNESS_WOOD  = 15;

const METAL_MATERIALS = new Set(['steel', 'stainless_steel', 'aluminum']);
const WOOD_MATERIALS  = new Set(['solid_wood', 'laminated_wood']);

// [RULE-LEG-04] Pedestal only valid for round or square tops
const PEDESTAL_VALID_SHAPES = new Set(['round', 'square']);

// [RULE-RADIAL-01] Minimum spread for radial halfcylinder base
const RADIAL_SPREAD_RATIO = 0.4; // legRadialSpreadMm >= 0.4 × totalHeightMm

// [RULE-RADIAL-02] Minimum number of halfcylinders
const RADIAL_MIN_COUNT = 3;

// [RULE-RADIAL-03] Minimum halfcylinder diameter
const RADIAL_MIN_DIAMETER_MM = 60;

export function checkLegRules(config: TableConfig): ValidationMessage[] {
  const violations: ValidationMessage[] = [];
  const warnings:   ValidationMessage[] = [];

  const {
    legMaterial,
    legProfileType,
    legProfileSizeMm,
    legHeightMm,
    legCount,
    topShapeType,
  } = config;

  // ── Radial halfcylinder base — separate rule set ──────────────────────────
  if (legProfileType === 'radial_halfcylinder') {
    const { legRadialSpreadMm, legRadialCount, totalHeightMm } = config;

    // [RULE-RADIAL-01] Spread >= 0.4 × totalHeight (replaces STAB-02 for radial)
    if (legRadialSpreadMm != null) {
      const minSpread = Math.ceil(RADIAL_SPREAD_RATIO * totalHeightMm);
      if (legRadialSpreadMm < minSpread) {
        violations.push({
          ruleId: 'RADIAL-01',
          field: 'legRadialSpreadMm',
          messagepl: `Promień rozstawu półwalców (${legRadialSpreadMm}mm) jest za mały. Przy całkowitej wysokości stołu ${totalHeightMm}mm wymagany minimalny promień to ${minSpread}mm (40% wysokości). Stół będzie niestabilny.`,
          messageTech: `Radial spread ${legRadialSpreadMm}mm < required ${minSpread}mm (0.4 × ${totalHeightMm}mm). Tipping risk.`,
        });
      }
    }

    // [RULE-RADIAL-02] Minimum count of halfcylinders
    if (legRadialCount != null && legRadialCount < RADIAL_MIN_COUNT) {
      violations.push({
        ruleId: 'RADIAL-02',
        field: 'legRadialCount',
        messagepl: `Podstawa promieniowa wymaga co najmniej ${RADIAL_MIN_COUNT} półwalców. Podano ${legRadialCount}.`,
        messageTech: `Radial halfcylinder count ${legRadialCount} < minimum ${RADIAL_MIN_COUNT}.`,
      });
    }

    // [RULE-RADIAL-03] Minimum halfcylinder diameter
    if (legProfileSizeMm < RADIAL_MIN_DIAMETER_MM) {
      violations.push({
        ruleId: 'RADIAL-03',
        field: 'legProfileSizeMm',
        messagepl: `Średnica każdego półwalca w podstawie promieniowej musi wynosić co najmniej ${RADIAL_MIN_DIAMETER_MM}mm. Podano ${legProfileSizeMm}mm.`,
        messageTech: `Radial halfcylinder diameter ${legProfileSizeMm}mm < min ${RADIAL_MIN_DIAMETER_MM}mm.`,
      });
    }

    return [...violations, ...warnings];
  }

  // ── Standard leg rules (LEG-01 … LEG-05) ─────────────────────────────────
  const isMetalLeg = METAL_MATERIALS.has(legMaterial);
  const isWoodLeg  = WOOD_MATERIALS.has(legMaterial);

  // [RULE-LEG-01] Metal profile minimums
  if (isMetalLeg) {
    const rule = LEG_MIN_PROFILES.find(
      r => r.materials.includes(legMaterial) && r.profileType === legProfileType,
    );
    if (rule && legProfileSizeMm < rule.minSizeMm) {
      violations.push({
        ruleId: 'LEG-01',
        field: 'legProfileSizeMm',
        messagepl: `Metalowa noga z profilem "${profileLabel(legProfileType)}" musi mieć wymiar co najmniej ${rule.minSizeMm}mm. Podano ${legProfileSizeMm}mm — zbyt mała przekrój nośny.`,
        messageTech: `Metal ${legProfileType} leg min size ${rule.minSizeMm}mm, got ${legProfileSizeMm}mm. ${rule.note}`,
      });
    }
  }

  // [RULE-LEG-02] Wood profile minimums
  if (isWoodLeg) {
    const minSize = legHeightMm >= WOOD_TALL_THRESHOLD ? WOOD_MIN_PROFILE_TALL : WOOD_MIN_PROFILE_SHORT;
    if (legProfileSizeMm < minSize) {
      violations.push({
        ruleId: 'LEG-02',
        field: 'legProfileSizeMm',
        messagepl: `Drewniana noga o wysokości ${legHeightMm}mm wymaga wymiaru przekroju co najmniej ${minSize}mm (podano ${legProfileSizeMm}mm). ${legHeightMm >= WOOD_TALL_THRESHOLD ? 'Przy wysokości ≥750mm wymagane jest 80mm.' : 'Przy wysokości <750mm wymagane jest 60mm.'}`,
        messageTech: `Wood leg h=${legHeightMm}mm requires min profile ${minSize}mm, got ${legProfileSizeMm}mm.`,
      });
    }
  }

  // [RULE-LEG-03] Slenderness ratio
  // λ = legHeight / profileSize — simplified radius of gyration approximation
  const slenderness = legHeightMm / legProfileSizeMm;

  if (isMetalLeg && slenderness > MAX_SLENDERNESS_METAL) {
    violations.push({
      ruleId: 'LEG-03',
      field: 'legProfileSizeMm',
      messagepl: `Smukłość nogi metalowej (λ = ${slenderness.toFixed(1)}) przekracza dopuszczalne ${MAX_SLENDERNESS_METAL}. Noga może ulec wyboczeniu. Zwiększ przekrój do min. ${Math.ceil(legHeightMm / MAX_SLENDERNESS_METAL)}mm lub zmniejsz wysokość.`,
      messageTech: `Metal leg slenderness λ=${slenderness.toFixed(2)} > max ${MAX_SLENDERNESS_METAL}. Euler buckling risk. Min profile: ${Math.ceil(legHeightMm / MAX_SLENDERNESS_METAL)}mm.`,
    });
  }

  if (isWoodLeg && slenderness > MAX_SLENDERNESS_WOOD) {
    violations.push({
      ruleId: 'LEG-03',
      field: 'legProfileSizeMm',
      messagepl: `Smukłość nogi drewnianej (λ = ${slenderness.toFixed(1)}) przekracza dopuszczalne ${MAX_SLENDERNESS_WOOD}. Ryzyko wyboczenia w drewnie. Zwiększ przekrój do min. ${Math.ceil(legHeightMm / MAX_SLENDERNESS_WOOD)}mm.`,
      messageTech: `Wood leg slenderness λ=${slenderness.toFixed(2)} > max ${MAX_SLENDERNESS_WOOD}. Buckling risk. Min profile: ${Math.ceil(legHeightMm / MAX_SLENDERNESS_WOOD)}mm.`,
    });
  }

  // [RULE-LEG-04] Pedestal only valid with round or square top
  if ((legCount === 1 || legProfileType === 'pedestal') && !PEDESTAL_VALID_SHAPES.has(topShapeType)) {
    violations.push({
      ruleId: 'LEG-04',
      field: 'legCount',
      messagepl: `Pojedyncza noga centralna (piedestał) jest dopuszczalna tylko dla blatów okrągłych lub kwadratowych. Blat o kształcie "${shapeLabel(topShapeType)}" wymaga co najmniej 4 nóg dla zapewnienia stabilności i równomiernego rozkładu obciążeń.`,
      messageTech: `Pedestal leg (count=1 or profileType=pedestal) invalid for ${topShapeType} top — only round/square allowed.`,
    });
  }

  // [RULE-LEG-05] Round/oval top with 4+ legs — placement warning
  if ((topShapeType === 'round' || topShapeType === 'oval') && legCount >= 4) {
    warnings.push({
      ruleId: 'LEG-05',
      field: 'legCount',
      messagepl: `Przy blacie okrągłym / owalnym z ${legCount} nogami należy zwrócić szczególną uwagę na symetryczne rozmieszczenie nóg względem środka ciężkości. Nierówny rozstaw może powodować niestabilność.`,
      messageTech: `Round/oval top with ${legCount} legs: ensure symmetric leg placement around centroid. Warning only.`,
    });
  }

  return [...violations, ...warnings];
}

function profileLabel(type: string): string {
  const labels: Record<string, string> = {
    round: 'okrągły',
    square: 'kwadratowy',
    rectangular: 'prostokątny',
    trestle: 'kozłowy',
    pedestal: 'centralny/piedestał',
  };
  return labels[type] ?? type;
}

function shapeLabel(shape: string): string {
  const labels: Record<string, string> = {
    rectangle: 'prostokąt',
    square: 'kwadrat',
    oval: 'owal',
    round: 'okrąg',
    custom: 'niestandardowy',
  };
  return labels[shape] ?? shape;
}
