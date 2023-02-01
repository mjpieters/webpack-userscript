import { UserscriptPlugin } from 'webpack-userscript';

import { compile } from '../util';
import { Volume } from '../volume';
import { Fixtures } from './fixtures';

describe('load-headers', () => {
  let input: Volume;

  beforeEach(async () => {
    input = Volume.fromJSON({
      '/entry.js': Fixtures.entryJs,
      '/headers.json': Fixtures.headersJson,
      '/package.json': Fixtures.packageJson,
    });
  });

  it('can be loaded from headers object', async () => {
    const output = await compile(input, {
      context: '/',
      mode: 'production',
      entry: '/entry.js',
      output: {
        path: '/dist',
        filename: 'headers.js',
      },
      plugins: [
        new UserscriptPlugin({
          headers: {
            name: 'headers-object',
          },
        }),
      ],
    });

    expect(output.toJSON()).toEqual({
      '/dist/headers.user.js':
        Fixtures.headersObjectHeaders + '\n' + Fixtures.entryMinJs,
      '/dist/headers.meta.js': Fixtures.headersObjectHeaders,
    });
  });

  it.todo('can be loaded from headers provider function');

  it.todo('can be loaded from headers file');
});
