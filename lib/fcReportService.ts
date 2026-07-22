// FILE PATH: bank_cdms_dashboard/lib/fcReportService.ts — NEW FILE
//
// Shared by the run and download routes so the parse-query-join pipeline
// lives in exactly one place.

import fs from "fs";
import path from "path";
import { getFc, getBrand, getValidStatuses } from "./config";
import { parseBrandFolder } from "./xlsxParser";
import { fetchCdmsInvoiceTotals } from "./cdmsQuery";
import { buildFcReport, type FcReport } from "./reportBuilder";

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export interface RunFcReportParams {
  root: string;
  brandFolder: string;
  fcFolder: string;
  // Optional explicit override range from the frontend date picker. If
  // omitted, the range derived from the xlsx files (min/max Bill Date) is
  // used as the query input, per spec.
  overrideFromDate?: Date;
  overrideToDate?: Date;
}

export interface RunFcReportResult {
  fcReport: FcReport;
  resolvedFromDate: Date;
  resolvedToDate: Date;
  fileCount: number;
}

export async function runFcReport(params: RunFcReportParams): Promise<RunFcReportResult> {
  const { root, brandFolder, fcFolder } = params;

  const fcConfig = getFc(brandFolder, fcFolder);
  if (!fcConfig) {
    throw new Error(`'${fcFolder}' is not a configured FC under brand '${brandFolder}'`);
  }

  const brandPath = path.join(root, brandFolder);
  const fcPath = path.join(brandPath, fcFolder);

  if (!fs.existsSync(fcPath) || !fs.statSync(fcPath).isDirectory()) {
    throw new Error(`FC folder not found on disk: ${fcPath}`);
  }

  const filePaths = fs
    .readdirSync(fcPath, { withFileTypes: true })
    .filter(e => e.isFile() && ACCEPTED_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
    .map(e => path.join(fcPath, e.name));

  if (filePaths.length === 0) {
    throw new Error(`No xlsx/csv files found in: ${fcPath}`);
  }

  const validStatuses = getValidStatuses();
  const parsedFolder = parseBrandFolder(filePaths, validStatuses);

  const resolvedFromDate = params.overrideFromDate ?? parsedFolder.billFromDate;
  const resolvedToDate = params.overrideToDate ?? parsedFolder.billToDate;

  if (!resolvedFromDate || !resolvedToDate) {
    throw new Error(
      `Could not resolve a date range for ${fcFolder} — Bill From/To Date cells were empty ` +
      `and no override range was supplied.`
    );
  }

  const brandConfig = getBrand(brandFolder);
  if (!brandConfig) {
    throw new Error(`'${brandFolder}' is not a configured brand`);
  }

  const cdmsResult = await fetchCdmsInvoiceTotals({
    fcId: fcConfig.fcId,
    brandId: brandConfig.brandId,
    fromDate: resolvedFromDate,
    toDate: resolvedToDate,
  });

  const fcReport = buildFcReport(
    parsedFolder.invoiceTotals,
    cdmsResult.allTotals,
    cdmsResult.excludedTotals
  );

  return {
    fcReport,
    resolvedFromDate,
    resolvedToDate,
    fileCount: parsedFolder.fileCount,
  };
}