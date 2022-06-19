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

  const pathToSavedPage = await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);
  const savedResult = fs.readFileSync(pathToSavedPage, 'utf-8');
  expect(pathToSavedPage).toEqual(expectedPathToSavedPage);
  expect(savedResult).toEqual(expectedResult);
  scope.done();
});

test('save images, valid address', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  const imagePath = '/assets/professions/nodejs.png';
  const expectedHtmlFileName = 'foo-baz-bar-qux.html';
  const expectedPathToSavedPage = path.join(tempDirectoryName, expectedHtmlFileName);
  const expectedImagePath = getAssetsPath('nodejs.png');
  const savedAssetsDirectory = 'foo-baz_files';
  const expectedFileName = 'foo-baz-assets-professions-nodejs.png';
  const answer = readFile('testPageWithImg.html');
  const expectedResultWihtImg = readFile('expextedPageWithImg.htm');
  const expectedPathToSavedImage = path.join(
    tempDirectoryName,
    savedAssetsDirectory,
    expectedFileName,
  );
  const { origin, pathname } = new URL(pageAddress);
  const scope = nock(origin)
    .get(pathname)
    .reply(200, answer, {
      'Content-Type': 'text/html',
    })
    .get(imagePath)
    .replyWithFile(200, expectedImagePath, {
      'Content-Type': 'image/png',
    });

  await loadPageAndGetSavedPagePath(pageAddress, tempDirectoryName);
  const expectedImage = readAssetsFile('nodejs.png');
  const resultHtml = fs.readFileSync(expectedPathToSavedPage, 'utf-8');
  const savedImage = fs.readFileSync(expectedPathToSavedImage, 'utf-8');
  expect(savedImage.toString('base64')).toEqual(expectedImage.toString('base64'));
  expect(expectedResultWihtImg).toEqual(resultHtml);
  scope.done();
});

test('save css, img, js resources, valid address', async () => {
  const pageAddress = 'https://foo.baz/bar/qux';
  const savedAssetsDirectory = 'foo-baz_files';

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
