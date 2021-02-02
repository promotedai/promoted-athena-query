import {
  GetQueryExecutionCommand,
  GetQueryExecutionCommandOutput,
  GetQueryResultsCommand,
  GetQueryResultsCommandOutput,
  StartQueryExecutionCommand,
  StartQueryExecutionCommandOutput,
} from '@aws-sdk/client-athena';
import { AthenaQuery } from './index';

/** Used in MockAthenaClient */
interface ExpectedStartQuery {
  command: StartQueryExecutionCommand;
  output: StartQueryExecutionCommandOutput;
}

/** Used in MockAthenaClient */
interface expectedWaitForSuccessfulResults {
  command: GetQueryExecutionCommand;
  output: GetQueryExecutionCommandOutput;
}

/** Used in MockAthenaClient */
interface ExpectedGetResults {
  command: GetQueryResultsCommand;
  output: GetQueryResultsCommandOutput;
}

class MockAthenaClient {
  expectedStartQueries: ExpectedStartQuery[];
  expectedWaitForSuccessfulResults: expectedWaitForSuccessfulResults[];
  expectedGetResults: ExpectedGetResults[];

  send = async (command: any) => {
    if (command instanceof StartQueryExecutionCommand) {
      if (this.expectedStartQueries.length === 0) {
        throw 'Expected more expectedStartQueries';
      }
      const expectedValues = this.expectedStartQueries.shift();
      expect(command?.input).toEqual(expectedValues?.command?.input);
      return expectedValues?.output;
    } else if (command instanceof GetQueryExecutionCommand) {
      if (this.expectedWaitForSuccessfulResults.length === 0) {
        throw 'Expected more expectedWaitForSuccessfulResults';
      }
      const expectedValues = this.expectedWaitForSuccessfulResults.shift();
      expect(command?.input).toEqual(expectedValues?.command?.input);
      return expectedValues?.output;
    } else if (command instanceof GetQueryResultsCommand) {
      if (this.expectedGetResults.length === 0) {
        throw 'Expected more expectedGetResults';
      }
      const expectedValues = this.expectedGetResults.shift();
      expect(command?.input).toEqual(expectedValues?.command?.input);
      return expectedValues?.output;
    } else {
      throw `Unsupported command: ${command}`;
    }
  };

  expectFinished = () => {
    expect(this.expectedStartQueries).toEqual([]);
    expect(this.expectedWaitForSuccessfulResults).toEqual([]);
    expect(this.expectedGetResults).toEqual([]);
  };
}

describe('processQuery', () => {
  it('simple success', async () => {
    const query = 'select * FROM my_db.my_table';
    const mockAthenaClient = new MockAthenaClient();

    mockAthenaClient.expectedStartQueries = [
      {
        command: new StartQueryExecutionCommand({ QueryString: query }),
        output: {
          $metadata: {},
          QueryExecutionId: 'abc-xyz',
        },
      },
    ];

    mockAthenaClient.expectedWaitForSuccessfulResults = [
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'SUCCEEDED',
            },
          },
        },
      },
    ];

    mockAthenaClient.expectedGetResults = [
      {
        command: new GetQueryResultsCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: { httpStatusCode: 200 },
          ResultSet: {
            Rows: [
              {
                Data: [{ VarCharValue: 'first_name' }, { VarCharValue: 'last_name' }],
              },
              {
                Data: [{ VarCharValue: 'John' }, { VarCharValue: 'Smith' }],
              },
            ],
          },
        },
      },
    ];

    const results: any[] = [];
    const athenaQuery = new AthenaQuery({
      athenaClient: mockAthenaClient as any,
      query,
      batchProcessor: async (rows) => {
        results.push(...rows);
      },
      sleepMs: 1,
    });
    await athenaQuery.processQuery();

    mockAthenaClient.expectFinished();
    expect(results).toEqual([
      {
        first_name: 'John',
        last_name: 'Smith',
      },
    ]);
  });

  it('multiple calls', async () => {
    const query = 'select * FROM my_db.my_table';
    const mockAthenaClient = new MockAthenaClient();

    mockAthenaClient.expectedStartQueries = [
      {
        command: new StartQueryExecutionCommand({ QueryString: query }),
        output: {
          $metadata: {},
          QueryExecutionId: 'abc-xyz',
        },
      },
    ];

    mockAthenaClient.expectedWaitForSuccessfulResults = [
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'QUEUED',
            },
          },
        },
      },
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'RUNNING',
            },
          },
        },
      },
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'SUCCEEDED',
            },
          },
        },
      },
    ];

    mockAthenaClient.expectedGetResults = [
      {
        command: new GetQueryResultsCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: { httpStatusCode: 200 },
          NextToken: 'NextResult1',
          ResultSet: {
            Rows: [
              {
                Data: [{ VarCharValue: 'first_name' }, { VarCharValue: 'last_name' }],
              },
              {
                Data: [{ VarCharValue: 'John' }, { VarCharValue: 'Smith' }],
              },
            ],
          },
        },
      },
      {
        command: new GetQueryResultsCommand({
          QueryExecutionId: 'abc-xyz',
          NextToken: 'NextResult1',
        }),
        output: {
          $metadata: { httpStatusCode: 200 },
          NextToken: 'NextResult2',
          ResultSet: {
            Rows: [
              {
                Data: [{ VarCharValue: 'Maria' }, { VarCharValue: 'Rodriguez' }],
              },
              {
                Data: [{ VarCharValue: 'Mary' }, { VarCharValue: 'Johnson' }],
              },
            ],
          },
        },
      },
      {
        command: new GetQueryResultsCommand({
          QueryExecutionId: 'abc-xyz',
          NextToken: 'NextResult2',
        }),
        output: {
          $metadata: { httpStatusCode: 200 },
          ResultSet: {
            Rows: [
              {
                Data: [{ VarCharValue: 'Joseph' }, { VarCharValue: 'Jones' }],
              },
            ],
          },
        },
      },
    ];

    const results: any[] = [];
    const athenaQuery = new AthenaQuery({
      athenaClient: mockAthenaClient as any,
      query,
      batchProcessor: async (rows) => {
        results.push(...rows);
      },
      sleepMs: 1,
    });
    await athenaQuery.processQuery();

    mockAthenaClient.expectFinished();
    expect(results).toEqual([
      {
        first_name: 'John',
        last_name: 'Smith',
      },
      {
        first_name: 'Maria',
        last_name: 'Rodriguez',
      },
      {
        first_name: 'Mary',
        last_name: 'Johnson',
      },
      {
        first_name: 'Joseph',
        last_name: 'Jones',
      },
    ]);
  });

  it('StartQuery failed', async () => {
    const query = 'select * FROM my_db.my_table';
    const mockAthenaClient = new MockAthenaClient();

    mockAthenaClient.expectedStartQueries = [
      {
        command: new StartQueryExecutionCommand({ QueryString: query }),
        output: {
          $metadata: {},
          QueryExecutionId: undefined,
        },
      },
    ];

    mockAthenaClient.expectedWaitForSuccessfulResults = [];
    mockAthenaClient.expectedGetResults = [];

    const results: any[] = [];
    const athenaQuery = new AthenaQuery({
      athenaClient: mockAthenaClient as any,
      query,
      batchProcessor: async (rows) => {
        results.push(...rows);
      },
    });
    try {
      await athenaQuery.processQuery();
    } catch (err) {
      // Expected.
    }
    mockAthenaClient.expectFinished();
    expect(results).toEqual([]);
  });

  it('GetQueryExecution failed', async () => {
    const query = 'select * FROM my_db.my_table';
    const mockAthenaClient = new MockAthenaClient();

    mockAthenaClient.expectedStartQueries = [
      {
        command: new StartQueryExecutionCommand({ QueryString: query }),
        output: {
          $metadata: {},
          QueryExecutionId: 'abc-xyz',
        },
      },
    ];

    mockAthenaClient.expectedWaitForSuccessfulResults = [
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'FAILED',
            },
          },
        },
      },
    ];

    mockAthenaClient.expectedGetResults = [];

    const results: any[] = [];
    const athenaQuery = new AthenaQuery({
      athenaClient: mockAthenaClient as any,
      query,
      batchProcessor: async (rows) => {
        results.push(...rows);
      },
      sleepMs: 1,
    });
    // await athenaQuery.processQuery();
    let throws = false;
    try {
      await athenaQuery.processQuery();
    } catch (err) {
      throws = true;
    }
    expect(throws).toBeTruthy();
    mockAthenaClient.expectFinished();
    expect(results).toEqual([]);
  });

  it('GetResults failed', async () => {
    const query = 'select * FROM my_db.my_table';
    const mockAthenaClient = new MockAthenaClient();

    mockAthenaClient.expectedStartQueries = [
      {
        command: new StartQueryExecutionCommand({ QueryString: query }),
        output: {
          $metadata: {},
          QueryExecutionId: 'abc-xyz',
        },
      },
    ];

    mockAthenaClient.expectedWaitForSuccessfulResults = [
      {
        command: new GetQueryExecutionCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: {},
          QueryExecution: {
            Status: {
              State: 'SUCCEEDED',
            },
          },
        },
      },
    ];

    mockAthenaClient.expectedGetResults = [
      {
        command: new GetQueryResultsCommand({ QueryExecutionId: 'abc-xyz' }),
        output: {
          $metadata: { httpStatusCode: 500 },
        },
      },
    ];

    const results: any[] = [];
    const athenaQuery = new AthenaQuery({
      athenaClient: mockAthenaClient as any,
      query,
      batchProcessor: async (rows) => {
        results.push(...rows);
      },
      sleepMs: 1,
    });
    let throws = false;
    try {
      await athenaQuery.processQuery();
    } catch (err) {
      throws = true;
    }
    expect(throws).toBeTruthy();
    mockAthenaClient.expectFinished();
    expect(results).toEqual([]);
  });
});
