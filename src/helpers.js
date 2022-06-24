import axios from 'axios';
import {
  writeFile,
  mkdir,
  access,
  rmdir,
} from 'fs/promises';
import path from 'path';
import * as yup from 'yup';
import * as cheerio from 'cheerio';
import 'axios-debug-log';
import debug from 'debug';
import Listr from 'listr';

const logger = debug('page-loader');

// can't use yup.string().url() because of http://localhost. It is an invalid addres for yup
// but hexlet tests use it as a page address
const schema = yup.string().test('is-url-valid', 'URL is not valid', (value) => new URL(value));

const validateUrl = (url) => schema.validate(url)
  .then((validUrl) => validUrl)
  .catch(() => {
    throw Error(`Error: ${url.toString()} must be a valid URL`);
  });

const createName = (resourceUrl, nameBasePart) => {
  const [resourseName, extention = 'html'] = resourceUrl.pathname.split('.');
  const filteredPath = resourseName
    .split('/')
    .filter((pathPart) => !!pathPart)
    .join('-');
  return `${nameBasePart}-${filteredPath}.${extention}`;
};

const assetTags = ['script', 'img', 'link'];

const mapping = {
  link: 'href',
  script: 'src',
  img: 'src',
};

const getAssetPath = (dom, element) => dom(element).attr(mapping[element.name]);

const setAssetPath = (dom, element, newPath) => {
  dom(element).attr(mapping[element.name], newPath);
};

const isSameOrigin = (resourcePath, sameOrigin) => {
  const url = new URL(resourcePath, sameOrigin);
  return url.origin === sameOrigin;
};

const hasResourcePath = (resoursePathname) => !!resoursePathname;

const prepareResourcesData = (pageUrl, pageContent) => {
  // subdomains isn't loaded. It needs to fix it!!!!!!!!!
  const { origin } = pageUrl;
  const nameBasePart = pageUrl.hostname.split('.').join('-');
  const assetsDirNamePart = pageUrl.pathname.split('/').join('-');
  const htmlFilename = createName(pageUrl, nameBasePart);
  const assetsDirectoryName = `${nameBasePart}${assetsDirNamePart}_files`;
  const dom = cheerio.load(pageContent);
  const assets = [];
  dom(assetTags.join(',')).each((i, element) => {
    const oldAssetPath = getAssetPath(dom, element);
    if (isSameOrigin(oldAssetPath, origin) && hasResourcePath(oldAssetPath)) {
      const assetUrl = new URL(oldAssetPath, origin);
      const assetFileName = createName(assetUrl, nameBasePart);
      const newAssetPath = path.join(assetsDirectoryName, assetFileName);
      const assetInfo = {
        url: assetUrl,
        assetPath: newAssetPath,
      };
      assets.push(assetInfo);
      setAssetPath(dom, element, newAssetPath);
    }
  });

  const preparedData = {
    pageContent: dom.html(),
    htmlFilename,
    assetsDirectoryName,
    assets,
  };

  return preparedData;
};

const clearAssetsDirectory = (directoryPath) => rmdir(directoryPath, { recursive: true })
  .then(() => directoryPath)
  .catch(() => directoryPath);

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

const makeAssetsDirectory = ({ assetsDirectoryName }, directoryPath) => (
  access(directoryPath)
    .then(() => {
      const assetsDirectoryPath = path.join(directoryPath, assetsDirectoryName);
      return assetsDirectoryPath;
    })
    .then((assetsDirectoryPath) => clearAssetsDirectory(assetsDirectoryPath))
    .then((assetsDirectoryPath) => mkdir(assetsDirectoryPath))
    .catch((error) => {
      logger('The following error was thrown: %O', error);
      const message = makeErrorMessage(error, directoryPath);
      throw Error(message);
    })
);

const downloadContent = (url) => axios.get(url.toString(), { responseType: 'arraybuffer' });

const downloadResourses = (resoursesData) => {
  const { assets, htmlFilename, pageContent } = resoursesData;
  const downloadAssets = [];
  const preparedTasks = assets.map(({ url, assetPath }) => {
    const promise = downloadContent(url);
    return {
      title: `${url.toString()} is downloading`,
      task: (ctx, task) => promise
        .then(({ data }) => {
          task.title = `${url.toString()} downloaded successfully`; // eslint-disable-line
          const assetData = { assetPath, data };
          downloadAssets.push(assetData);
        })
        .catch((error) => {
          task.title = `${url.toString()} downloading failed`; // eslint-disable-line
          throw (error);
        }),
    };
  });
  const tasks = new Listr(preparedTasks, { concurrent: true });
  return tasks
    .run()
    .then(() => {
      const downloadedResourcesData = {
        htmlFilename,
        pageContent,
        downloadAssets,
      };
      return downloadedResourcesData;
    })
    .catch((error) => {
      logger('The following error was thrown %O', error);
      if (error.isAxiosError) {
        const message = `Error: Request to ${error.config.url} failed with status code ${error.response.status}`;
        throw Error(message);
      }
      throw Error('Error: Unprocessed error occurred. Please, run the application with debug for more information');
    });
};

const saveContent = ({ htmlFilename, pageContent, downloadAssets }, directoryPath) => {
  const pathToSavedHtmlFile = path.join(directoryPath, htmlFilename);
  return writeFile(pathToSavedHtmlFile, pageContent)
    .then(() => {
      const promises = downloadAssets.map(({ assetPath, data }) => {
        const fullPath = path.join(directoryPath, assetPath);
        return writeFile(fullPath, data);
      });
      return promises;
    })
    .then((promises) => Promise.all(promises))
    .then(() => pathToSavedHtmlFile)
    .catch((error) => {
      logger('The following error was thrown: %O', error);
      throw Error('Error: Unprocessed error occurred. Please, run the application with debug for more information');
    });
};

export {
  validateUrl,
  prepareResourcesData,
  makeAssetsDirectory,
  downloadResourses,
  saveContent,
  logger,
  downloadContent,
};
