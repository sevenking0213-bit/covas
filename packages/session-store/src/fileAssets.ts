import { copyFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { resolveSessionPaths } from './paths';

export type StoreSessionImageInput = {
  projectDir: string;
  sessionId: string;
  pageId: string;
  sourceFilePath: string;
  fileName?: string;
  thumbnailFileName?: string;
};

export type StoredSessionImagePaths = {
  assetPath: string;
  thumbnailPath: string;
};

export async function storeSessionImage(input: StoreSessionImageInput): Promise<StoredSessionImagePaths> {
  const paths = resolveSessionPaths(input.projectDir, input.sessionId);
  const fileName = input.fileName ?? basename(input.sourceFilePath);
  const thumbnailFileName = input.thumbnailFileName ?? fileName;
  const pageDir = resolve(paths.pagesDir, input.pageId);
  const assetsDir = resolve(pageDir, 'assets');
  const thumbnailsDir = resolve(pageDir, 'thumbnails');
  const assetPath = resolve(assetsDir, fileName);
  const thumbnailPath = resolve(thumbnailsDir, thumbnailFileName);

  await mkdir(assetsDir, { recursive: true });
  await mkdir(thumbnailsDir, { recursive: true });
  await copyFile(input.sourceFilePath, assetPath);
  await copyFile(input.sourceFilePath, thumbnailPath);

  return { assetPath, thumbnailPath };
}
