import {
  test,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import url from 'url';
import path from 'path';
import fs from 'fs';
import {
  mkdtemp,
  rmdir,
  chmod,
  writeFile,
} from 'fs/promises';
import os from 'os';
import nock from 'nock';

import loadPageAndGetSavedPagePath from '../src/index';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const readFile = (filename) => fs.readFileSync(getFixturePath(filename), 'utf-8');

const getAssetsPath = (filename) => path.join(__dirname, '..', '__fixtures__', 'assets', filename);
const readAssetsFile = (filename) => fs.readFileSync(getAssetsPath(filename), 'utf-8');

const expectedResult = readFile('expextedHtmlFile.html');

let tempDirectoryName;

beforeEach(async () => {
  tempDirectoryName = await mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

afterEach(async () => {
  await rmdir(tempDirectoryName, { recursive: true });
});

test('save css, img, js resources, valid address', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  const savedAssetsDirectory = 'foo-baz-bar-qux_files';

  const imagePath = '/assets/professions/nodejs.png';
  const expectedImagePath = getAssetsPath('nodejs.png');
  const expectedFileName = 'foo-baz-assets-professions-nodejs.png';
  const expectedPathToSavedImage = path.join(
    tempDirectoryName,
    savedAssetsDirectory,
    expectedFileName,
  );
  const expectedImage = readAssetsFile('nodejs.png');

  const cssPath = '/assets/application.css';
  const expectedCssPath = getAssetsPath('application.css');
  const expectedCssFileName = 'foo-baz-assets-application.css';
  const expectedPathToSavedCss = path.join(
    tempDirectoryName,
    savedAssetsDirectory,
    expectedCssFileName,
  );
  const expectedCss = readAssetsFile('application.css');

  const jsPath = '/packs/js/runtime.js';
  const expectedJsPath = getAssetsPath('runtime.js');
  const expectedJsFileName = 'foo-baz-packs-js-runtime.js';
  const expectedPathToSavedJs = path.join(
    tempDirectoryName,
    savedAssetsDirectory,
    expectedJsFileName,
  );
  const expectedJs = readAssetsFile('runtime.js');

  const expectedHtmlFileName = 'foo-baz-bar-qux.html';
  const expectedPathToSavedPage = path.join(tempDirectoryName, expectedHtmlFileName);
  const expectedPathToSavedHtml = path.join(
    tempDirectoryName,
    savedAssetsDirectory,
    expectedHtmlFileName,
  );
  const answer = readFile('testPageWithResourses.html');
  const expectedResultWihtResources = readFile('expextedPageWithResources.html');

  const { origin, pathname } = new URL(pageAddress);
  const scope = nock(origin)
    .get(pathname)
    .reply(200, answer, {
      'Content-Type': 'text/html',
    })
    .get(cssPath)
    .replyWithFile(200, expectedCssPath, {
      'Content-Type': 'text/css',
    })
    .get(pathname)
    .reply(200, answer, {
      'Content-Type': 'text/html',
    })
    .get(imagePath)
    .replyWithFile(200, expectedImagePath, {
      'Content-Type': 'image/png',
    })
    .get(jsPath)
    .replyWithFile(200, expectedJsPath, {
      'Content-Type': 'text/js',
    });

  await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);

  const resultHtml = fs.readFileSync(expectedPathToSavedPage, 'utf-8');
  const savedImage = fs.readFileSync(expectedPathToSavedImage, 'utf-8');
  const savedCssFile = fs.readFileSync(expectedPathToSavedCss, 'utf-8');
  const savedJsFile = fs.readFileSync(expectedPathToSavedJs, 'utf-8');
  const savedHtmlFile = fs.readFileSync(expectedPathToSavedHtml, 'utf-8');
  expect(savedImage.toString('base64')).toEqual(expectedImage.toString('base64'));
  expect(savedCssFile).toEqual(expectedCss);
  expect(expectedJs).toEqual(savedJsFile);
  expect(resultHtml).toEqual(expectedResultWihtResources);
  expect(savedHtmlFile).toEqual(answer);
  scope.done();
});

test('directory is not exist', async () => {
  const notExistDirectory = '/notExistDirectory';
  const expectedErrorMessage = `Directory ${notExistDirectory} doesn't exist`;

  const pageAddress = 'https://foo.baz/bar/qux';
  const { origin, pathname } = new URL(pageAddress);
  nock(origin)
    .get(pathname)
    .reply(200, expectedResult, {
      'Content-Type': 'text/html',
    });

  expect.assertions(1);
  try {
    await loadPageAndGetSavedPagePath(pageAddress, '/notExistDirectory');
  } catch (e) {
    expect(e.message).toMatch(expectedErrorMessage);
  }
});

test('No access', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  await chmod(tempDirectoryName, '100'); // only read
  const expectedErrorMessage = `No access to write in ${tempDirectoryName}`;
  const { origin, pathname } = new URL(pageAddress);
  nock(origin)
    .get(pathname)
    .reply(200, expectedResult, {
      'Content-Type': 'text/html',
    });

  expect.assertions(1);
  try {
    await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);
  } catch (e) {
    expect(e.message).toMatch(expectedErrorMessage);
  }
});

test('Write in a file instead of a directory', async () => {
  const filename = 'filename.js';
  const pathToFile = path.join(tempDirectoryName, filename);
  await writeFile(pathToFile, ''); // create an empty file to try to write into it
  const expectedErrorMessage = `${pathToFile} is not a directory`;

  const pageAddress = 'https://foo.baz/bar/qux';
  const { origin, pathname } = new URL(pageAddress);
  nock(origin)
    .get(pathname)
    .reply(200, expectedResult, {
      'Content-Type': 'text/html',
    });

  expect.assertions(1);
  try {
    await loadPageAndGetSavedPagePath(pageAddress, pathToFile);
  } catch (e) {
    expect(e.message).toMatch(expectedErrorMessage);
  }
});

test('invalid page address', async () => {
  const pageAddress = 'invalidUrl.invalid';
  const expectedErrorMessage = `Error: ${pageAddress} must be a valid URL`;

  expect.assertions(1);
  try {
    await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);
  } catch (e) {
    expect(e.message).toMatch(expectedErrorMessage);
  }
});

test('cannot download assets', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  const imagePath = '/assets/professions/nodejs.png';
  const notFoundCode = 404;
  const answer = readFile('testPageWithImg.html');
  const { origin, pathname } = new URL(pageAddress);

  nock(origin)
    .get(pathname)
    .reply(200, answer, {
      'Content-Type': 'text/html',
    })
    .get(imagePath)
    .reply(notFoundCode);

  const requestedResourceUrl = `${origin}${imagePath}`;
  const expectedErrorMessage = `Request to ${requestedResourceUrl} failed with status code ${notFoundCode}`;

  expect.assertions(1);
  try {
    await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);
  } catch (e) {
    expect(e.message).toMatch(expectedErrorMessage);
  }
});
