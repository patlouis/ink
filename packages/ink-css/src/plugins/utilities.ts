//stackpress
import type Component from '@stackpress/ink/dist/compiler/Component';
//common
import type { UtilityPluginOptions } from '../types';
import StyleParser from '../StyleParser';
import Stylers from '../Stylers';

export function utilities(
  document: Component, 
  options: UtilityPluginOptions = {}
) {
  //destructure the options
  const { 
    files = [], 
    contents = {},
    stylers: processors = []
  } = options;
  //make a new style generator
  const stylers = new Stylers(processors);
  //make a new parser
  const { fs, cwd } = document;
  const parser = new StyleParser({ fs, cwd });
  //add all the contents to the parser
  Object.entries(contents).forEach(([filePath, content]) => {
    parser.set(filePath, content);
  });
  //add all the files to the parser
  files.forEach(file => parser.add(file));
  //return the utilities plugin
  return (sheet: string, brand: string) => {
    const directive = `@${brand} utilities;`;
    if (!sheet.includes(directive)) {
      return sheet;
    }
    //return the stylesheet
    const styles = stylers.parse(parser).toString();
    return sheet.replaceAll(directive, styles);
  };
};