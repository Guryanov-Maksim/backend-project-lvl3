import axios from 'axios';
import { writeFile, mkdir, access } from 'fs/promises';
import path from 'path';
import * as yup from 'yup';
import * as cheerio from 'cheerio';
import 'axios-debug-log';
import debug from 'debug';
import fs from 'fs';

const logger = debug('page-loader');

const schema = yup.string().url();

const validateUrl = (url) => schema.validate(url).catch(() => {
  throw Error(`Error: ${url.toString()} must be a valid URL`);
});

const mapping = {
  link: 'href',
  script: 'src',
  img: 'src',
};

const getResoursePath = (element, elementName) => element.attr(mapping[elementName]);

const setResoursePath = (element, newPath, elementName) => {
  element.attr(mapping[elementName], newPath);
};

const isCrossOrigin = (resourcePath, base) => {
  const url = new URL(resourcePath, base);
  return url.origin !== base;
};

const createResourceName = (resourceUrl, nameBasePart) => {
  const [resourseName, extention = 'html'] = resourceUrl.pathname.split('.');
  const filteredPath = resourseName
    .split('/')
    .filter((pathPart) => !!pathPart)
    .join('-');
  return `${nameBasePart}-${filteredPath}.${extention}`;
};

const resoursesTags = 'script, img, link';

const prepareResourcesData = (dom, base, nameBasePart, resourcesDirectory) => {
  const resourcesData = [];
  dom(resoursesTags).each((i, element) => {
    const tagName = element.name;
    const resoursePathname = getResoursePath(dom(element), element.name);
    const resourceInfo = {
      id: i,
      tagName,
      url: new URL(resoursePathname, base),
    };
    resourcesData.push(resourceInfo);
  });
  const preparedData = resourcesData
    .map((resourceInfo) => {
      const resourceFileName = createResourceName(resourceInfo.url, nameBasePart);
      const resourcePath = path.join(resourcesDirectory, resourceFileName);
      return { ...resourceInfo, resourcePath };
    })
    .filter(({ url }) => url.origin === base);
  return preparedData;
};

const getReplacedDom = (dom, resources, base) => {
  // need to crate a deep clone of the dom parameter to make this funtion clear
  dom(resoursesTags).each((i, element) => {
    const oldPath = getResoursePath(dom(element), element.name);
    if (isCrossOrigin(oldPath, base)) {
      return;
    }
    const { resourcePath } = resources.find((resource) => resource.id === i);
    setResoursePath(dom(element), resourcePath, element.name);
  });
  return dom;
};

// GET request for remote image in node.js
// axios({
//   method: 'get',
//   url: 'https://bit.ly/2mTM3nY',
//   responseType: 'stream'
// })
//   .then(function (response) {
//     response.data.pipe(fs.createWriteStream('ada_lovelace.jpg'))
//   });

const isImageRequested = (tagName) => tagName === 'img';

const downloadResourses = async (resoursesData) => {
  try {
    const promises = resoursesData.map(({ tagName, url }) => {
      if (isImageRequested(tagName)) {
        return axios.get(url.toString(), { responseType: 'stream' });
      }
      return axios.get(url.toString());
    });
    const responses = await Promise.all(promises);
    const resourses = resoursesData.map((resourceData, index) => {
      const { data } = responses[index];
      return { ...resourceData, content: data };
    });
    return resourses;
  } catch (error) {
    logger('The following error was thrown %O', error);
    if (error.isAxiosError) {
      const message = `Error: Request to ${error.config.url} failed with status code ${error.response.status}`;
      throw Error(message);
    }
    throw Error('Error: Unprocessed error occurred. Please, run the application with debug for more information');
  }
};

const saveContent = (fullPath, content) => {
  try {
    return writeFile(fullPath, content);
  } catch (error) {
    logger('The following error was thrown: %O', error);
    throw Error('Error: Unprocessed error occurred. Please, run the application with debug for more information');
  }
};

const downloadPage = async (url) => {
  const response = await axios.get(url.toString());
  const { data } = response;
  return data;
};

const isDirectoryExist = (directoryPath) => {
  try {
    fs.accessSync(directoryPath);
    return true;
  } catch {
    return false;
  }
};

const makeErrorMessage = (error, directoryPath) => {
  switch (error.code) {
    case 'ENOENT':
      return `Error: Directory ${directoryPath} doesn't exist`;
    case 'EACCES':
      return `Error: No access to write in ${directoryPath}`;
    case 'ENOTDIR':
      return `Error: ${directoryPath} is not a directory`;
    default:
      return 'Error: Unprocessed error occurred. Please, run the application with debug for more information';
  }
};

const makeAssetsDirectory = async (resoursesDirectory, directoryPath) => {
  try {
    await access(directoryPath);

    const resourceDirectoryPath = path.join(directoryPath, resoursesDirectory);
    if (isDirectoryExist(resourceDirectoryPath)) {
      fs.rmdir(resourceDirectoryPath, { recursive: true }, () => {});
    }
    await mkdir(resourceDirectoryPath);
    return true;
  } catch (error) {
    logger('The following error was thrown: %O', error);
    const message = makeErrorMessage(error, directoryPath);
    throw Error(message);
  }
};

export default async (pageAddress, directoryPath) => {
  logger('The application is running');
  const validPageAddress = await validateUrl(pageAddress);
  const pageUrl = new URL(validPageAddress);

  logger('Page loading started');
  const pageContent = await downloadPage(pageUrl);
  logger('Page loaded successfully');

  const nameBasePart = pageUrl.hostname.split('.').join('-');
  const htmlFilename = createResourceName(pageUrl, nameBasePart);
  const pathToSavedHtmlFile = path.join(directoryPath, htmlFilename);
  const resoursesDirectory = `${nameBasePart}_files`;
  await makeAssetsDirectory(resoursesDirectory, directoryPath);
  logger('Directory for the assets created');

  const dom = cheerio.load(pageContent);
  // hide a dom inside prepareResoucesData and getReplacedDom
  const resoursesData = prepareResourcesData(
    dom,
    pageUrl.origin,
    nameBasePart,
    resoursesDirectory,
  );
  logger('Assets loading started');
  const resources = await downloadResourses(resoursesData);
  logger('Assets loading complited');
  const changedDom = getReplacedDom(dom, resources, pageUrl.origin);
  // console.log(changedDom.html());
  logger('Assets saving is in the progress');
  await saveContent(pathToSavedHtmlFile, changedDom.html());
  const resourcePromises = resources.map(({ resourcePath, content }) => {
    const fullPath = path.join(directoryPath, resourcePath);
    return saveContent(fullPath, content);
  });
  await Promise.all(resourcePromises);
  logger('Assets saved successfully');
  logger('The application finished');

  return pathToSavedHtmlFile;
};
