    // FILE PATH: bank_cdms_dashboard/lib/config.ts — NEW FILE

    import fs from "fs";
    import path from "path";

    export interface BrandConfig {
    folderName: string;
    brandId: number;
    }

    export interface FcConfig {
    folderName: string;
    fcId: number;
    brandFolderName: string;
    }

    export interface BrandFcConfig {
    validCollectionStatuses: string[];
    brands: BrandConfig[];
    fcs: FcConfig[];
    }

    let cached: BrandFcConfig | null = null;

    export function loadConfig(): BrandFcConfig {
    if (cached) return cached;

    const configPath = path.join(process.cwd(), "config", "brand-fc.json");

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config not found at: ${configPath}`);
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as BrandFcConfig;

    if (!Array.isArray(parsed.brands) || !Array.isArray(parsed.fcs)) {
        throw new Error("config/brand-fc.json is malformed: expected 'brands' and 'fcs' arrays");
    }

    cached = parsed;
    return cached;
    }

    export function getBrand(folderName: string): BrandConfig | undefined {
    return loadConfig().brands.find(b => b.folderName === folderName);
    }

    export function getFc(brandFolderName: string, fcFolderName: string): FcConfig | undefined {
    return loadConfig().fcs.find(
        f => f.brandFolderName === brandFolderName && f.folderName === fcFolderName
    );
    }

    export function getFcsForBrand(brandFolderName: string): FcConfig[] {
    return loadConfig().fcs.filter(f => f.brandFolderName === brandFolderName);
    }

    export function getValidStatuses(): string[] {
    return loadConfig().validCollectionStatuses;
    }

    // Dev convenience: clears the in-memory cache so edits to brand-fc.json are
    // picked up without restarting the server. Not used in production paths.
    export function clearConfigCache() {
    cached = null;
    }