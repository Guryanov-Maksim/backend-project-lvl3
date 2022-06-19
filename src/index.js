import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import * as yup from 'yup';
import * as cheerio from 'cheerio';

const schema = yup.string().url();

const validateUrl = (url) => schema.validateSync(url);

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
};

const saveContent = (fullPath, content) => writeFile(fullPath, content);

const downloadPage = async (url) => {
  const response = await axios.get(url.toString());
  const { data } = response;
  return data;
};

export default async (pageAddress, directoryPath) => {
  try {
    const validPageAddress = validateUrl(pageAddress);
    const pageUrl = new URL(validPageAddress);
    const nameBasePart = pageUrl.hostname.split('.').join('-');
    const htmlFilename = createResourceName(pageUrl, nameBasePart);
    const pathToSavedHtmlFile = path.join(directoryPath, htmlFilename);
    const resoursesDirectory = `${nameBasePart}_files`;
    const resourceDirectoryPath = path.join(directoryPath, resoursesDirectory);
    await mkdir(resourceDirectoryPath);

    const pageContent = await downloadPage(pageUrl);
    const dom = cheerio.load(pageContent);

    const resoursesData = prepareResourcesData(
      dom,
      pageUrl.origin,
      nameBasePart,
      resoursesDirectory,
    );
    const resources = await downloadResourses(resoursesData);
    const changedDom = getReplacedDom(dom, resources, pageUrl.origin);
    // console.log(changedDom.html());
    await saveContent(pathToSavedHtmlFile, changedDom.html());
    const resourcePromises = resources.map(({ resourcePath, content }) => {
      const fullPath = path.join(directoryPath, resourcePath);
      return saveContent(fullPath, content);
    });
    await Promise.all(resourcePromises);
    return pathToSavedHtmlFile;
  } catch (e) {
    console.error(e);
    return '';
  }
};
