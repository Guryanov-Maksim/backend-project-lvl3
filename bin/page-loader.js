#!/usr/bin/env node

import { program } from 'commander';
import loadPageAndGetSavedPagePath from '../src/index.js'; // eslint-disable-line

program
  .description('Page loader utility')
  .version('1.0.0', '-V, --version', 'output the version number')
  .argument('<url>', 'a page address that will be used to download the page html')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action((url) => {
    const { output } = program.opts();
    loadPageAndGetSavedPagePath(url, output)
      .then((savedPagePath) => {
        console.log(`Page was successfully downloaded into ${savedPagePath}`);
        const successAppCode = 0;
        process.exit(successAppCode);
      })
      .catch((error) => {
        const failedAppCode = 1;
        console.error(error.message);
        process.exit(failedAppCode);
      });
  });

program.parse();
