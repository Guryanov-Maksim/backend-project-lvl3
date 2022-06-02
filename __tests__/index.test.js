import {
  test,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import url from 'url';
import path from 'path';
import fs from 'fs';
import { mkdtemp, rmdir } from 'fs/promises';
import os from 'os';
import nock from 'nock';

import loadPageAndGetSavedPagePath from '../src/index';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const readFile = (filename) => fs.readFileSync(getFixturePath(filename), 'utf-8');

const expectedResult = readFile('test.html');

let tempDirectoryName;

beforeEach(async () => {
  tempDirectoryName = await mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

afterEach(async () => {
  await rmdir(tempDirectoryName, { recursive: true });
});

test('save page, valid address', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  const expectedFileName = 'foo-baz-bar-qux.html';
  const expectedPathToSavedPage = [tempDirectoryName, expectedFileName].join('/');
  const { origin, pathname } = new URL(pageAddress);
  const scope = nock(origin)
    .get(pathname)
    .reply(200, expectedResult, {
      'Content-Type': 'text/html',
    });

  const pathToSavedPage = await loadPageAndGetSavedPagePath(tempDirectoryName, pageAddress);
  const savedResult = fs.readFileSync(pathToSavedPage, 'utf-8');
  expect(pathToSavedPage).toEqual(expectedPathToSavedPage);
  expect(savedResult).toEqual(expectedResult);
  scope.done();
});
