import {
  validateUrl,
  prepareResourcesData,
  makeAssetsDirectory,
  downloadResourses,
  saveContent,
  logger,
  downloadContent,
} from './helpers';

/* *********************************
Баг в том, что когда запускаешь дебагеры page-loader и axios одновременно,
то строки с зарузкой статики появляются по два раза и одна из них не завершается,
хотя все скачивается и сохраняется.
По отдельности дебагеры работают нормально.
Как устанить пока не понятно.

DEBUG=page-loader,axios page-loader https://ru.hexlet.io/courses

page-loader The application is running +0ms
page-loader Page loading started +8ms
axios GET https://ru.hexlet.io/courses +0ms
axios 200 OK (GET https://ru.hexlet.io/courses) +1s
page-loader Page loaded successfully +1s
page-loader Directory for the assets created +235ms
page-loader Assets loading started +0ms
axios GET https://ru.hexlet.io/lessons.rss +239ms
axios GET https://ru.hexlet.io/courses +1ms
⠼ https://ru.hexlet.io/lessons.rss is downloading
✔ https://ru.hexlet.io/lessons.rss downloaded successfully
✔ https://ru.hexlet.io/lessons.rss downloaded successfully
✔ https://ru.hexlet.io/courses downloaded successfully
page-loader Assets loading complited +1s
page-loader Assets saving is in the progress +0ms
page-loader Assets saved successfully +16ms
page-loader The application finished +0ms
Page was successfully downloaded into /ru-hexlet-io-courses.html
*/

export default async (pageAddress, directoryPath) => (
  Promise.resolve(logger('The application is running'))
    .then(() => validateUrl(pageAddress))
    .then((validPageAddress) => {
      logger('Page loading started');
      const pageUrl = new URL(validPageAddress);
      return downloadContent(pageUrl)
        .then(({ data }) => ({ pageUrl, pageContent: data }));
    })
    .then(({ pageUrl, pageContent }) => {
      logger('Page loaded successfully');
      const resoursesData = prepareResourcesData(pageUrl, pageContent, directoryPath);
      return resoursesData;
    })
    .then((resoursesData) => (
      makeAssetsDirectory(resoursesData, directoryPath)
        .then(() => {
          logger('Directory for the assets created');
          return resoursesData;
        })
    ))
    .then((resoursesData) => {
      logger('Assets loading started');
      return downloadResourses(resoursesData);
    })
    .then((downloadedResourcesData) => {
      logger('Assets loading complited');
      logger('Assets saving is in the progress');
      return saveContent(downloadedResourcesData, directoryPath)
        .then((pathToSavedHtmlFile) => {
          logger('Assets saved successfully');
          logger('The application finished');
          return pathToSavedHtmlFile;
        });
    })
);
