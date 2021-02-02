import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryExecutionCommandOutput,
  GetQueryResultsCommand,
  GetQueryResultsInput,
  Row,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';

/**
 * This function is used to process rows in batches.  The Athena Node library
 * requires using a continuation token fetch pattern when fetching large results.
 */
export type BatchProcessor = (rows: any[]) => Promise<void>;

interface GetResultOutput {
  // Depends on the request.
  Data: any[];
  NextToken: string | undefined;
  fieldNames: string[];
}

interface AthenaQueryInput {
  athenaClient: AthenaClient;
  query: string;
  batchProcessor: BatchProcessor;
  sleepMs?: number;
}

export class AthenaQuery {
  private athenaClient: AthenaClient;
  private query: string;
  private batchProcessor: BatchProcessor;
  private QueryExecutionId: string | undefined;
  private sleepMs: number;

  constructor(input: AthenaQueryInput) {
    this.athenaClient = input.athenaClient;
    this.query = input.query;
    this.batchProcessor = input.batchProcessor;
    this.sleepMs = input.sleepMs !== undefined ? input.sleepMs : 500;
  }

  processQuery = async () => {
    if (this.QueryExecutionId !== undefined) {
      throw Error('AthenaQuery can only be used once.');
    }
    await this.startQuery();
    if (this.QueryExecutionId === undefined) {
      throw Error('Expected a QueryExecutionId');
    }
    await this.waitForSuccessfulResult();
    // TODO - check status codes.
    await this.getResultsInBatches();
  };

  /**
   * @param {string} QueryString the query
   * @returns {Promise<string | undefined>} the QueryExecutionId
   */
  private startQuery = async () => {
    const startResponse = await this.athenaClient.send(
      new StartQueryExecutionCommand({
        QueryString: this.query,
      })
    );
    this.QueryExecutionId = startResponse.QueryExecutionId;
    if (this.QueryExecutionId === undefined) {
      throw Error(
        `Expected a QueryExecutionId after calling startQuery, startResponse=${JSON.stringify(startResponse)}`
      );
    }
  };

  /**
   * @param {string} QueryExecutionId ID for Query
   */
  private waitForSuccessfulResult = async () => {
    let stateResponse = await this.athenaClient.send(
      new GetQueryExecutionCommand({
        QueryExecutionId: this.QueryExecutionId,
      })
    );
    while (!isTerminalState(getState(stateResponse))) {
      if (this.sleepMs > 0) {
        await sleep(this.sleepMs);
      }
      stateResponse = await this.athenaClient.send(
        new GetQueryExecutionCommand({
          QueryExecutionId: this.QueryExecutionId,
        })
      );
    }
    const responseState = getState(stateResponse);
    if (responseState !== 'SUCCEEDED') {
      throw Error(`Unsupported response state, ${responseState}, stateResponse=${stateResponse}`);
    }
  };

  /**
   * A way of processing larger Athena queries in batches.
   *
   * @param {string} QueryExecutionId ID for Query
   * @param {BatchProcessor} batchProcessor callback function to process data in batches
   */
  private getResultsInBatches = async () => {
    const results = await this.getResults(
      {
        QueryExecutionId: this.QueryExecutionId,
      },
      true,
      []
    );

    const { fieldNames } = results;
    let { Data, NextToken } = results;
    // TODO - do this in parallel.
    await this.batchProcessor(Data);
    while (NextToken !== undefined) {
      const pageResults = await this.getResults(
        {
          QueryExecutionId: this.QueryExecutionId,
          NextToken,
        },
        false,
        fieldNames
      );

      ({ Data, NextToken } = pageResults);
      // TODO - do this in parallel.
      await this.batchProcessor(Data);
    }
  };

  /**
   * @param {GetQueryResultsInput} input the input to the Athena call
   * @param {boolean} isFirstQuery used to pull header from first row
   * @param {string[]} fieldNames if first row, pass empty array
   * @returns {Promise<GetResultOutput>} the results
   */
  private getResults = async (
    input: GetQueryResultsInput,
    isFirstQuery: boolean,
    fieldNames: string[]
  ): Promise<GetResultOutput> => {
    const response = await this.athenaClient.send(new GetQueryResultsCommand(input));
    if (response['$metadata'].httpStatusCode !== 200) {
      throw Error(`GetQueryResults failed, response=${JSON.stringify(response)}`);
    }

    // TODO - check status codes.
    let rows = response?.ResultSet?.Rows;
    // TODO - verify the length is greater than one.
    if (isFirstQuery) {
      const undefineableFields: string[] | undefined = rows?.[0]?.Data?.map((data, index) =>
        data?.VarCharValue === undefined ? `col${index}` : data?.VarCharValue
      );
      fieldNames = undefineableFields !== undefined ? undefineableFields : [];
      rows = rows?.slice(1);
    }
    return {
      Data: rows ? fromRowsToJsonValues(rows, fieldNames) : [],
      NextToken: response.NextToken,
      fieldNames,
    };
  };
}

// TODO - support continuation token fetching.

/**
 * @param {Row[]} rows list of rows
 * @param {string[]} fieldNames list of field names
 * @returns {any[]} the rows converted from Athena format to row dictionaries
 */
function fromRowsToJsonValues(rows: Row[], fieldNames: string[]): any[] {
  return rows.map((row) => {
    const result: any = {};
    row?.Data?.forEach((data, index) => {
      const fieldName = fieldNames[index];
      if (!fieldName) {
        throw `Header row is not long enough.`;
      }
      result[fieldName] = data?.VarCharValue;
    });
    return result;
  });
}

/**
 * @param {GetQueryExecutionCommandOutput} response the output from an Athena call
 * @returns {string | undefined} the state of the query
 */
function getState(response: GetQueryExecutionCommandOutput): string | undefined {
  return response?.QueryExecution?.Status?.State;
}

/**
 * @param {string | undefined} state state from Athena query
 * @returns {boolean} if the state is terminal
 */
function isTerminalState(state: string | undefined) {
  return state !== 'QUEUED' && state !== 'RUNNING';
}

/**
 * @param {number} ms milliseconds to sleep
 * @returns {Promise<void>} a promise (so we can call await on it)
 */
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
