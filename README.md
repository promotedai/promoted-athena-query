# promoted-athena-query

This library is used to simplify calling AWS Athena.

```
import {AthenaClient} from '@aws-sdk/client-athena';
import {AthenaQuery} from 'promoted-athena-query';

const athenaClient = new AthenaClient({
    region: 'YOUR_AWS_REGION',
    credentials: {
        accessKeyId: 'YOUR_AWS_ACCESS_KEY_ID',
        secretAccessKey: 'YOUR_AWS_SECRET_ACCESS_KEY'
    },
});

export const index = async (): Promise<void> =>
    new AthenaQuery({
        athenaClient,
        query: 'SELECT * FROM my_db.my_table',
        batchProcessor: async (rows) => {
            // Process rows in batches for large queries.
            console.log(rows);
        },
    }).processQuery();
```


## Features

Uses
- [TypeScript](https://www.typescriptlang.org/) support
- [React](https://reactjs.org/) support
- [ESLint](https://eslint.org/) (with [React](https://reactjs.org/) and [Prettier](https://prettier.io/))
- Unit tests ([Jest](https://jestjs.io/) and [Testing Library](https://testing-library.com/))
- Minified output with [Terser](https://terser.org/)
- Bundle size validation with [size-limit](https://github.com/ai/size-limit)
- Flexible builds with [Rollup](https://www.rollupjs.org/)
- [CHANGELOG.md](https://keepachangelog.com/en/1.0.0/) template

## Scripts

- Run most commands: `npm run finish`
- Build the project: `npm run build`
  - Validate output bundle size with `npm run size`
- Lint the project: `npm run lint`
- Run unit tests: `npm test` or `npm test`

## When developing locally

If you want to test local changes in an actual deployment, use `npm link`.

1. Run `npm run updateLink`.
4. Go to client directory and run `npm link promoted-athena-query`.

When you update `promoted-athena-query`, run `npm run updateLink`.

When you want to undo, use `npm unlink` in `promoted-athena-query/dist` and `npm unlink promoted-athena-query` in the client directory.

## Deploy

We use a GitHub action that runs semantic-release to determine how to update versions.  Just do a normal code review and this should work.  Depending on the message prefixes (e.g. `feat: `, `fix: `, `clean: `, `docs: `), it'll update the version appropriately.

# Resources

The base of this repository is a combination of the following repos:
- https://github.com/DenysVuika/react-lib
- https://github.com/Alexandrshy/como-north and https://dev.to/alexandrshy/creating-a-template-repository-in-github-1d05
