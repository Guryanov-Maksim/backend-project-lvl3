import axios from 'axios';
import { fsPromise as fs } from 'fs/promises';
/*  TODO
*
* 1. Load a page from the Internet
* 2. Save a page content
* 3. Return the path to the file with a saved content
*
*/
const validate = (url) => url;

const downloadPage = async (url) => {
  const validUrl = validate(url);
  const response = await axios.get(validUrl);
  const { data } = response;
  return data;
};

const saveContent = async (fullPath, content) => {
  await fs.writeFile(fullPath, content);
};

const loadPage = async (directoryPath, url) => {
  const content = await downloadPage(url);
  const fullPath = '';
  try {
    await saveContent(fullPath, content);
    return fullPath;
  } catch (e) {
    console.error(e);
  }
};

export default loadPage;
