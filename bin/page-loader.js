#!/usr/bin/env node

import { program } from 'commander';
import loadPageAndGetSavedPagePath from '../src/index.js'; // eslint-disable-line

program
  .description('Page loader utility')
  .version('1.0.0', '-V, --version', 'output the version number')
  .argument('<url>', 'a page address that will be used to download the page html')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action(async (url) => {
    const { output } = program.opts();
    const savedPagePath = await loadPageAndGetSavedPagePath(url, output);
    console.log(savedPagePath);
  });

await program.parseAsync();
