// FILE PATH: bank_cdms_dashboard/lib/reportBuilder.ts — REPLACE EXISTING

export interface InvoiceRow {
  invoiceNo: string;
  brandCollection: number | null;       // null = not in brand file
  cdmsTotalCollection: number | null;   // CDMS total (all payments, incl. unsettled cheques)
  cdmsAdjustedCollection: number | null;// CDMS excl. unsettled-cheque invoices (null if excluded)
  excludedCdmsAmount: number | null;    // populated only for excluded invoices; null otherwise
  netDifference: number;                // cdmsAdjusted - brand (0 for missing sides)
}

export interface FcSummary {
  brandCollectionTotal: number;
  cdmsTotalCollectionTotal: number;       // gross CDMS (all)
  cdmsAdjustedCollectionTotal: number;    // CDMS after excluding unsettled-cheque invoices
  pendingChequeValue: number;             // sum of CDMS for excluded invoices
  excessCollectionValue: number;          // cdmsAdjusted > brand
  shortCollectionValue: number;           // brand > cdmsAdjusted
  netDifference: number;                  // cdmsAdjusted - brand, signed
  netDifferenceSign: "+" | "-" | "0";
  invoiceCount: number;
}

export interface FcReport {
  invoices: InvoiceRow[];
  summary: FcSummary;
}

/**
 * Full outer join across three sets:
 *   - brandTotals:    invoice_no -> brand collected amount
 *   - cdmsAllTotals:  invoice_no -> CDMS total (all filtered payments)
 *   - cdmsExcluded:   invoice_no -> CDMS amount for invoices with unsettled cheques
 *
 * Every invoice from any side appears. Excess/Short/Net are computed against
 * cdmsAdjusted (cdmsAll minus excluded invoices) vs brand, per spec.
 */
export function buildFcReport(
  brandTotals: Map<string, number>,
  cdmsAllTotals: Map<string, number>,
  cdmsExcluded: Map<string, number>
): FcReport {
  const allInvoiceNos = new Set<string>([
    ...brandTotals.keys(),
    ...cdmsAllTotals.keys(),
  ]);

  const invoices: InvoiceRow[] = [];

  let brandCollectionTotal = 0;
  let cdmsTotalCollectionTotal = 0;
  let cdmsAdjustedCollectionTotal = 0;
  let pendingChequeValue = 0;
  let excessCollectionValue = 0;
  let shortCollectionValue = 0;

  for (const invoiceNo of allInvoiceNos) {
    const brandAmount = brandTotals.has(invoiceNo) ? brandTotals.get(invoiceNo)! : null;
    const cdmsTotalAmount = cdmsAllTotals.has(invoiceNo) ? cdmsAllTotals.get(invoiceNo)! : null;
    const isExcluded = cdmsExcluded.has(invoiceNo);

    // If the invoice is excluded (unsettled cheque), cdmsAdjusted = null so
    // it doesn't flow into Excess/Short/Net. The excluded amount is shown in
    // its own column instead.
    const cdmsAdjustedAmount = isExcluded ? null : cdmsTotalAmount;
    const excludedCdmsAmount = isExcluded ? (cdmsTotalAmount ?? 0) : null;

    const brandVal = brandAmount ?? 0;
    const cdmsAdjVal = cdmsAdjustedAmount ?? 0;
    const diff = cdmsAdjVal - brandVal;

    invoices.push({
      invoiceNo,
      brandCollection: brandAmount,
      cdmsTotalCollection: cdmsTotalAmount,
      cdmsAdjustedCollection: cdmsAdjustedAmount,
      excludedCdmsAmount,
      netDifference: diff,
    });

    brandCollectionTotal += brandVal;
    cdmsTotalCollectionTotal += cdmsTotalAmount ?? 0;

    if (isExcluded) {
      pendingChequeValue += cdmsTotalAmount ?? 0;
    } else {
      cdmsAdjustedCollectionTotal += cdmsTotalAmount ?? 0;
      if (diff > 0) excessCollectionValue += diff;
      if (diff < 0) shortCollectionValue += Math.abs(diff);
    }
  }

  invoices.sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));

  const netDifference = excessCollectionValue - shortCollectionValue;
  const netDifferenceSign: FcSummary["netDifferenceSign"] =
    netDifference > 0 ? "+" : netDifference < 0 ? "-" : "0";

  return {
    invoices,
    summary: {
      brandCollectionTotal,
      cdmsTotalCollectionTotal,
      cdmsAdjustedCollectionTotal,
      pendingChequeValue,
      excessCollectionValue,
      shortCollectionValue,
      netDifference,
      netDifferenceSign,
      invoiceCount: invoices.length,
    },
  };
}

export interface TaggedInvoiceRow extends InvoiceRow {
  fcName: string;
}

export function mergeFcReports(
  reportsByFc: { fcName: string; report: FcReport }[]
): { invoices: TaggedInvoiceRow[]; summary: FcSummary } {
  const invoices: TaggedInvoiceRow[] = [];

  let brandCollectionTotal = 0;
  let cdmsTotalCollectionTotal = 0;
  let cdmsAdjustedCollectionTotal = 0;
  let pendingChequeValue = 0;
  let excessCollectionValue = 0;
  let shortCollectionValue = 0;

  for (const { fcName, report } of reportsByFc) {
    for (const row of report.invoices) invoices.push({ ...row, fcName });
    brandCollectionTotal += report.summary.brandCollectionTotal;
    cdmsTotalCollectionTotal += report.summary.cdmsTotalCollectionTotal;
    cdmsAdjustedCollectionTotal += report.summary.cdmsAdjustedCollectionTotal;
    pendingChequeValue += report.summary.pendingChequeValue;
    excessCollectionValue += report.summary.excessCollectionValue;
    shortCollectionValue += report.summary.shortCollectionValue;
  }

  const netDifference = excessCollectionValue - shortCollectionValue;
  const netDifferenceSign: FcSummary["netDifferenceSign"] =
    netDifference > 0 ? "+" : netDifference < 0 ? "-" : "0";

  return {
    invoices,
    summary: {
      brandCollectionTotal,
      cdmsTotalCollectionTotal,
      cdmsAdjustedCollectionTotal,
      pendingChequeValue,
      excessCollectionValue,
      shortCollectionValue,
      netDifference,
      netDifferenceSign,
      invoiceCount: invoices.length,
    },
  };
}