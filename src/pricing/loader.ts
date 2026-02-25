import * as fs from 'fs';
import * as path from 'path';

// Placeholder pricing loader — reads a CSV with material price data.
// Full pricing logic not yet implemented.
// CSV format: material,thickness_mm,price_per_sqm_pln

export interface MaterialPriceEntry {
  material: string;
  thicknessMm: number;
  pricePerSqmPln: number;
}

export type MaterialPriceMap = Map<string, MaterialPriceEntry[]>;

/**
 * Loads material prices from a CSV file.
 * Returns a map keyed by material name, with a list of price entries per thickness.
 *
 * @param csvPath - absolute or relative path to the CSV file
 */
export function loadMaterialPrices(csvPath: string): MaterialPriceMap {
  const absolutePath = path.resolve(csvPath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  const priceMap: MaterialPriceMap = new Map();

  // Skip header row
  const dataLines = lines.slice(1);

  for (const line of dataLines) {
    const [material, thicknessMmRaw, priceRaw] = line.split(',').map(s => s.trim());

    if (!material || !thicknessMmRaw || !priceRaw) continue;

    const thicknessMm     = parseInt(thicknessMmRaw, 10);
    const pricePerSqmPln  = parseFloat(priceRaw);

    if (isNaN(thicknessMm) || isNaN(pricePerSqmPln)) continue;

    const entry: MaterialPriceEntry = { material, thicknessMm, pricePerSqmPln };

    if (!priceMap.has(material)) {
      priceMap.set(material, []);
    }
    priceMap.get(material)!.push(entry);
  }

  return priceMap;
}
