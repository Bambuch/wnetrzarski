export type TopMaterial = 'sintered_stone' | 'quartz' | 'marble' | 'granite';
export type TopShapeType = 'rectangle' | 'square' | 'oval' | 'round' | 'custom';
export type TopEdgeFinish = 'straight' | 'beveled' | 'rounded' | 'mitered';
export type TopConstruction = 'solid' | 'composite';
export type LegCount = 1 | 2 | 3 | 4 | 5 | 6;
export type LegMaterial = 'steel' | 'stainless_steel' | 'aluminum' | 'solid_wood' | 'laminated_wood';
export type LegProfileType = 'round' | 'square' | 'rectangular' | 'trestle' | 'pedestal' | 'radial_halfcylinder';

export interface TableConfig {
  // TOP (BLAT)
  topMaterial: TopMaterial;
  topThicknessMm: number;            // total thickness, e.g. 6, 12, 20, 30, 45
  topShapeType: TopShapeType;
  topLengthMm: number;               // longer dimension
  topWidthMm: number;                // shorter dimension
  topEdgeFinish: TopEdgeFinish;
  topConstruction?: TopConstruction; // 'solid' | 'composite', defaults to 'solid'
  topFaceThicknessMm?: number;       // thickness of each face panel — composite only
  // core thickness = topThicknessMm − 2 × topFaceThicknessMm (derived, not stored)

  // LEGS (NOGI)
  legCount: LegCount;
  legMaterial: LegMaterial;
  legProfileType: LegProfileType;
  legProfileSizeMm: number;          // diameter or side length; for radial: halfcylinder diameter
  legProfileWidthMm?: number;        // only for rectangular profile
  legHeightMm: number;               // height of leg only, not including top
  hasFootBase: boolean;              // stopa pod nogą
  legRadialCount?: 3 | 4 | 5 | 6 | 8;  // number of halfcylinders — radial_halfcylinder only
  legRadialSpreadMm?: number;            // radius of spread from centre (mm) — radial only

  // FULL TABLE
  totalHeightMm: number;             // should equal legHeightMm + topThicknessMm
}

export interface FieldConstraint {
  min: number;
  max: number;
  reason: string;  // Polish, shown inline next to the field
}

export interface FieldConstraints {
  topThicknessMm:   FieldConstraint & { recommended: number };
  topFaceThicknessMm: FieldConstraint & { recommended: number };
  topLengthMm:      FieldConstraint;
  topWidthMm:       FieldConstraint;
  totalHeightMm:    FieldConstraint;
  legProfileSizeMm: FieldConstraint;
  legRadialSpreadMm: FieldConstraint;
}

export interface ValidationMessage {
  ruleId: string;
  field: keyof TableConfig;
  messagepl: string;      // explanation in Polish for end user
  messageTech: string;    // technical explanation in English for logs
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationMessage[];
  violations: ValidationMessage[];
  suggestedConfig?: TableConfig;
}
