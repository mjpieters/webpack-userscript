import path from 'node:path';
import { promisify } from 'node:util';

import { Compiler } from 'webpack';

import { findPackage, FsReadFile, FsStat, readJSON } from '../fs';
import {
  HeadersProps,
  UserscriptPluginInstance,
  WaterfallContext,
} from '../types';
import { Feature } from './feature';

export type HeadersProvider = (
  headers: HeadersProps,
  ctx: WaterfallContext,
) => HeadersProps | Promise<HeadersProps>;

export interface LoadHeadersOptions {
  root?: string;
  headers?: HeadersProps | string | HeadersProvider;
}

export class LoadHeaders extends Feature<LoadHeadersOptions> {
  public readonly name = 'LoadHeaders';

  private defaultHeaders: HeadersProps = {};
  private fileHeaders: HeadersProps = {};
  private headersFileTimestamp = 0;

  public apply({ hooks }: UserscriptPluginInstance): void {
    hooks.init.tapPromise(this.name, async (compiler) => {
      const { headers } = this.options;

      this.defaultHeaders = Object.assign(
        {},
        await this.loadFromPackage(compiler),
        typeof headers === 'object' ? headers : {},
      );
    });

    hooks.preprocess.tapPromise(this.name, async (compilation) => {
      const getFileTimestampAsync = promisify(
        compilation.fileSystemInfo.getFileTimestamp.bind(
          compilation.fileSystemInfo,
        ),
      );

      if (typeof this.options.headers === 'string') {
        const headersFile = path.resolve(
          this.options.root ?? compilation.compiler.context,
          this.options.headers,
        );

        const ts = await getFileTimestampAsync(headersFile);

        if (
          ts &&
          typeof ts === 'object' &&
          typeof ts.timestamp === 'number' &&
          this.headersFileTimestamp >= ts.timestamp
        ) {
          // file no change
          return;
        }

        if (ts && typeof ts === 'object') {
          this.headersFileTimestamp = ts.timestamp ?? this.headersFileTimestamp;
        }

        this.fileHeaders = await this.loadFromHeadersFile(
          headersFile,
          compilation.inputFileSystem as FsReadFile,
        );

        compilation.fileDependencies.add(headersFile);
      }
    });

    hooks.headers.tapPromise(this.name, async (_, ctx) => {
      const headers = {
        ...this.defaultHeaders,
        ...this.fileHeaders,
      };

      if (typeof this.options.headers === 'function') {
        return await this.options.headers(headers, ctx);
      }

      return headers;
    });
  }

  private async loadFromPackage({
    context,
    inputFileSystem,
  }: Compiler): Promise<HeadersProps> {
    const { root } = this.options;
    try {
      const projectDir = await findPackage(
        root ?? context,
        inputFileSystem as FsStat,
      );
      const packageJson = await readJSON<PackageInfo>(
        path.join(projectDir, 'package.json'),
        inputFileSystem as FsReadFile,
      );

      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        author: packageJson.author,
        homepage: packageJson.homepage,
        supportURL:
          typeof packageJson.bugs === 'string'
            ? packageJson.bugs
            : typeof packageJson.bugs === 'object' &&
              typeof packageJson.bugs.url === 'string'
            ? packageJson.bugs.url
            : undefined,
      };
    } catch (e) {
      return {};
    }
  }

  private loadFromHeadersFile(
    headersFile: string,
    fs: FsReadFile,
  ): Promise<HeadersProps> {
    return readJSON<HeadersProps>(headersFile, fs);
  }
}

interface PackageInfo {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  homepage?: string;
  bugs?: string | { url?: string };
}
