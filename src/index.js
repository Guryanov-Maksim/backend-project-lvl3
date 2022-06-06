import axios from 'axios';
import { writeFile } from 'fs/promises';
import path from 'path';
import * as yup from 'yup';

const schema = yup.string().url();

const validateUrl = (url) => schema.validateSync(url);

const downloadPage = async (pageAddress) => {
  const url = new URL(pageAddress);
  const { origin, pathname } = url;
  const response = await axios.get(pathname, { baseURL: origin });
  const { data } = response;
  return data;
};

const saveContent = (fullPath, content) => writeFile(fullPath, content);

const createFileName = (pageAddress) => {
  const extention = 'html';
  const url = new URL(pageAddress);
  const { hostname, pathname } = url;
  const filteredHostname = hostname.split('.');
  const filteredPathName = pathname.split('/').filter((page) => !!page);
  const fileName = [
    ...filteredHostname,
    ...filteredPathName,
  ].join('-');

  return `${fileName}.${extention}`;
};

export default async (url, directoryPath) => {
  try {
    const validUrl = validateUrl(url);
    const fileNameForSaving = createFileName(validUrl);
    const fullPath = path.join(directoryPath, fileNameForSaving);
    const content = await downloadPage(validUrl);
    await saveContent(fullPath, content);
    return fullPath;
  } catch (e) {
    console.error(e);
    return '';
  }
};
