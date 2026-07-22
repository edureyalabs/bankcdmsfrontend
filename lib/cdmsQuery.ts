// FILE PATH: bank_cdms_dashboard/lib/cdmsQuery.ts — REPLACE EXISTING

import { runAthenaQuery } from "./athena";

export interface CdmsQueryParams {
  fcId: number;
  brandId: number;
  fromDate: Date;
  toDate: Date;
}

function toSqlDateTime(d: Date, endOfDay: boolean): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function getBufferDays(): number {
  const raw = process.env.CHEQUE_SETTLEMENT_BUFFER_DAYS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return isNaN(parsed) || parsed < 0 ? 10 : parsed; // default 10
}

export interface CdmsRow {
  invoiceNo: string;
  invoiceDate: string | null;
  orderStatus: string | null;
  collectedAmount: number;
  // true when this invoice should be excluded from the adjusted comparison:
  // either the cheque is unsettled (bank_settlement_cheque_id IS NULL) OR
  // it is settled but due_date is within CHEQUE_SETTLEMENT_BUFFER_DAYS of
  // today (settled but not yet "aged enough" to be reliable).
  hasExcludedCheque: boolean;
}

export async function fetchCdmsCollections(params: CdmsQueryParams): Promise<CdmsRow[]> {
  const fromStr = toSqlDateTime(params.fromDate, false);
  const toStr   = toSqlDateTime(params.toDate, true);
  const bufferDays = getBufferDays();

  // CTE 1 (filtered_payments): unchanged base filter — same joins, same
  // payment_type / verification filters. Added due_date column for Layer 2.
  //
  // CTE 2 (excluded_cheque_orders): among those already-filtered rows,
  // find order_ids to exclude. Two conditions, either is sufficient:
  //   Layer 1 — payment_type='Cheque' AND bank_settlement_cheque_id IS NULL
  //             (unsettled cheque)
  //   Layer 2 — payment_type='Cheque' AND bank_settlement_cheque_id IS NOT NULL
  //             AND date_diff('day', date(due_date), current_date) <= N
  //             (settled but due_date not yet N days in the past)
  //
  // Main query: GROUP BY as before, flag per invoice via LEFT JOIN.
  const sql = `
    with filtered_payments as (
      select
        o.id            as order_id,
        o.invoice_no,
        o.invoice_date,
        o.status        as orderstatus,
        p.amount,
        p.payment_type,
        p.bank_settlement_cheque_id,
        p.due_date
      from orders o
      left join collection_invoices ci on o.id = ci.order_id
      left join payments p on ci.id = p.collection_invoice_id
      where o.invoice_date between '${fromStr}' and '${toStr}'
        and o.fc_id    = ${params.fcId}
        and o.brand_id = ${params.brandId}
        and p.amount is not null
        and p.payment_type in ('UPI','Cash','NEFT','Cheque')
        and p.payment_verification_status not in ('ChequeBounced')
    ),
    excluded_cheque_orders as (
      select distinct order_id
      from filtered_payments
      where payment_type = 'Cheque'
        and (
          -- Layer 1: unsettled (bank_settlement_cheque_id blank/null)
          bank_settlement_cheque_id is null
          or trim(cast(bank_settlement_cheque_id as varchar)) = ''
          -- Layer 2: settled but due_date not yet aged past buffer
          or (
            bank_settlement_cheque_id is not null
            and trim(cast(bank_settlement_cheque_id as varchar)) <> ''
            and due_date is not null
            and date_diff('day', date(due_date), current_date) <= ${bufferDays}
          )
        )
    )
    select
      fp.invoice_no,
      fp.invoice_date,
      fp.orderstatus,
      sum(fp.amount)                                                        as collected_amount,
      max(case when eco.order_id is not null then 1 else 0 end)             as has_excluded_cheque
    from filtered_payments fp
    left join excluded_cheque_orders eco on fp.order_id = eco.order_id
    group by 1,2,3
  `;

  const rows = await runAthenaQuery(sql);

  return rows.map(r => ({
    invoiceNo:        String(r.invoice_no ?? "").trim(),
    invoiceDate:      r.invoice_date ?? null,
    orderStatus:      r.orderstatus ?? null,
    collectedAmount:  parseFloat(r.collected_amount ?? "0") || 0,
    hasExcludedCheque: String(r.has_excluded_cheque ?? "0").trim() === "1",
  }));
}

export interface CdmsInvoiceTotalsResult {
  allTotals:      Map<string, number>; // all invoices, gross CDMS
  excludedTotals: Map<string, number>; // invoices excluded (unsettled OR not aged)
}

export async function fetchCdmsInvoiceTotals(
  params: CdmsQueryParams
): Promise<CdmsInvoiceTotalsResult> {
  const rows = await fetchCdmsCollections(params);

  const allTotals      = new Map<string, number>();
  const excludedTotals = new Map<string, number>();

  for (const row of rows) {
    if (!row.invoiceNo) continue;
    allTotals.set(row.invoiceNo, (allTotals.get(row.invoiceNo) ?? 0) + row.collectedAmount);
    if (row.hasExcludedCheque) {
      excludedTotals.set(row.invoiceNo, (excludedTotals.get(row.invoiceNo) ?? 0) + row.collectedAmount);
    }
  }

  return { allTotals, excludedTotals };
}