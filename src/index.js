import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import * as yup from 'yup';
import * as cheerio from 'cheerio';

const schema = yup.string().url();

const validateUrl = (url) => schema.validateSync(url);

const getImageLinks = (dom) => {
  const links = [];
  dom('img').each((i, element) => {
    links.push(dom(element).attr('src'));
  });
  return links;
};

const createPathToAssetsFileName = (link, nameBasePart, assetsDirectory) => {
  const filteredName = link
    .split('/')
    .filter((pathPart) => !!pathPart)
    .join('-');
  const fileName = `${nameBasePart}-${filteredName}`;
  const pathToSavedImageFile = path.join(assetsDirectory, fileName);
  return pathToSavedImageFile;
};

const getReplacedDom = (dom, basePart, assetsDirectoryName) => {
  dom('img').each((i, element) => {
    const oldSrc = dom(element).attr('src');
    const assetsFileName = createPathToAssetsFileName(oldSrc, basePart, assetsDirectoryName);
    dom(element).attr('src', assetsFileName);
  });
  return dom;
};

const downloadPageImages = async ({ origin }, links) => {
  const promises = links.map((link) => axios.get(link, { baseURL: origin, responseType: 'stream' }));
  const responses = await Promise.all(promises);
  return responses;
};

const saveContent = (fullPath, content) => writeFile(fullPath, content);

const downloadPage = async ({ origin, pathname }) => {
  const response = await axios.get(pathname, { baseURL: origin });
  const { data } = response;
  return data;
};

export default async (pageAddress, directoryPath) => {
  try {
    const validUrl = validateUrl(pageAddress);
    const url = new URL(validUrl);
    const nameBasePart = url.hostname.split('.').join('-');
    const htmlFilename = url.pathname
      .split('/')
      .filter((pathPart) => !!pathPart)
      .join('-');
    const htmlFileExtention = 'html';
    const savedHtmlFilename = `${nameBasePart}-${htmlFilename}.${htmlFileExtention}`;
    const pathToSavedHtmlFile = path.join(directoryPath, savedHtmlFilename);
    const assetsDirectoryName = `${nameBasePart}_files`;
    const assetsDirectory = path.join(directoryPath, assetsDirectoryName);
    await mkdir(assetsDirectory);

    const content = await downloadPage(url);
    const dom = cheerio.load(content);
    const imageLinks = getImageLinks(dom);
    const responsesWitImages = await downloadPageImages(url, imageLinks);

    const dataForSavingImages = imageLinks.map((imageLink, index) => {
      const pathToSavedImageFile = createPathToAssetsFileName(
        imageLink,
        nameBasePart,
        assetsDirectory,
      );
      const { data } = responsesWitImages[index];
      return { name: pathToSavedImageFile, data };
    });

    dataForSavingImages.forEach(async ({ name, data }) => {
      await saveContent(name, data);
    });

    const changedDom = getReplacedDom(dom, nameBasePart, assetsDirectoryName);
    await saveContent(pathToSavedHtmlFile, changedDom.html());
    return pathToSavedHtmlFile;
  } catch (e) {
    console.error(e);
    return '';
  }
};
