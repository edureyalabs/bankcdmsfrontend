// FILE PATH: bank_cdms_dashboard/lib/athena.ts — NEW FILE
//
// Minimal Athena query runner. Starts a query against ATHENA_DATABASE,
// writing results to ATHENA_OUTPUT_S3_BUCKET, polls until SUCCEEDED/FAILED/
// CANCELLED, then reads back the result rows via GetQueryResults (paginated).
//
// Auth/region come from the existing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// / AWS_REGION env vars already used elsewhere in this project.

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  type Row as AthenaRow,
  type ColumnInfo,
} from "@aws-sdk/client-athena";

const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 150; // ~2 minutes max wait

function getClient() {
  return new AthenaClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function rowsToObjects(columns: ColumnInfo[], rows: AthenaRow[]): Record<string, string | null>[] {
  // Athena's GetQueryResults always includes the header row as the first
  // result row when there's no NextToken from a prior page — strip it once
  // by the caller, not here, since pagination makes "first row" ambiguous
  // across pages. Caller handles header stripping on the very first page.
  return rows.map(row => {
    const obj: Record<string, string | null> = {};
    (row.Data ?? []).forEach((cell, i) => {
      obj[columns[i].Name ?? `col_${i}`] = cell.VarCharValue ?? null;
    });
    return obj;
  });
}

export async function runAthenaQuery(sql: string): Promise<Record<string, string | null>[]> {
  const client = getClient();

  const database = process.env.ATHENA_DATABASE;
  const outputLocation = process.env.ATHENA_OUTPUT_S3_BUCKET;

  if (!database || !outputLocation) {
    throw new Error(
      "ATHENA_DATABASE and ATHENA_OUTPUT_S3_BUCKET must be set in .env.local"
    );
  }

  const start = await client.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: database },
      ResultConfiguration: { OutputLocation: outputLocation },
    })
  );

  const queryExecutionId = start.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error("Athena did not return a QueryExecutionId");
  }

  // Poll until terminal state
  let state: string | undefined;
  let attempts = 0;
  let failureReason: string | undefined;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const exec = await client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId })
    );
    state = exec.QueryExecution?.Status?.State;
    failureReason = exec.QueryExecution?.Status?.StateChangeReason;

    if (state === "SUCCEEDED") break;
    if (state === "FAILED" || state === "CANCELLED") {
      throw new Error(`Athena query ${state}: ${failureReason ?? "no reason given"}`);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;
  }

  if (state !== "SUCCEEDED") {
    throw new Error(`Athena query timed out after ${attempts} polling attempts`);
  }

  // Fetch all result pages
  const allRows: AthenaRow[] = [];
  let columns: ColumnInfo[] = [];
  let nextToken: string | undefined;
  let isFirstPage = true;

  do {
    const resultsPage = await client.send(
      new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        NextToken: nextToken,
      })
    );

    if (isFirstPage) {
      columns = resultsPage.ResultSet?.ResultSetMetadata?.ColumnInfo ?? [];
    }

    const pageRows = resultsPage.ResultSet?.Rows ?? [];
    // The first row of the FIRST page only is the header row — skip it.
    const dataRows = isFirstPage ? pageRows.slice(1) : pageRows;
    allRows.push(...dataRows);

    nextToken = resultsPage.NextToken;
    isFirstPage = false;
  } while (nextToken);

  return rowsToObjects(columns, allRows);
}