//modules
import type { ProjectOptions } from 'ts-morph';
import path from 'node:path';
import ts from 'typescript';
import { Project, IndentationText } from 'ts-morph';
//directives
import type DirectiveInterface from '../directives/DirectiveInterface';
import { 
  IfDirective,
  ElifDirective,
  ElseDirective
} from '../directives/ConditionalDirective';
import { 
  TryDirective,
  CatchDirective
} from '../directives/TryCatchDirective';
import IteratorDirective from '../directives/IteratorDirective';
//common
import type { MarkupToken, MarkupChildToken, ObjectToken } from '../types';
//local
import type Component from './Component';
import Parser from './Parser';

/**
 * Converts a parsed component to a transpiled JS/TS source code
 */
export default class Transpiler {
  //compiler
  protected _component: Component;
  //ts-morph project options
  protected _config: ProjectOptions;
  //directive registry
  protected _directives = new Map<string, DirectiveInterface>();

  /**
   * Returns the component
   */
  public get component() {
    return this._component;
  }

  /**
   * Returns the compiled body script to put in template() 
   */
  public get markup() {
    return this._markup(
      null, 
      this._component.ast.markup, 
      this._component.components
    );
  }

  /**
   * Sets the compiler and generator options
   */
  constructor(component: Component, tsconfig?: string) {
    //compiler
    this._component = component;
    this._config = {
      tsConfigFilePath: tsconfig,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        // Generates corresponding '.d.ts' file.
        declaration: true, 
        // Generates a sourcemap for each corresponding '.d.ts' file.
        declarationMap: true, 
        // Generates corresponding '.map' file.
        sourceMap: true, 
        // Set the module system
        module: ts.ModuleKind.CommonJS
      },
      manipulationSettings: {
        indentationText: IndentationText.TwoSpaces
      }
    };
    //add directives
    this.directive(new IfDirective(this));
    this.directive(new ElifDirective(this));
    this.directive(new ElseDirective(this));
    this.directive(new TryDirective(this));
    this.directive(new CatchDirective(this));
    this.directive(new IteratorDirective(this));
  }

  /**
   * Adds a directive to the compiler
   */
  public directive(directive: DirectiveInterface) {
    this._directives.set(directive.name, directive);
    return this;
  }

  /**
   * Generates component code to be used on the browser
   */
  public transpile() {
    const { 
      id,
      absolute,
      classname, 
      imports,
      styles, 
      scripts,
      field,
      observe
    } = this._component;
    //determine tagname
    const tagname = this._component.brand 
      ? `${this._component.brand}-${this._component.tagname}`
      : this._component.tagname;
    //get path without extension
    //ex. /path/to/Counter.ink -> /path/to/Counter
    const extname = path.extname(absolute);
    const filePath = absolute.slice(0, -extname.length);
    //create a new source file
    const { source } = this._createSourceFile(`${filePath}.ts`);
    //import ClientRegistry from '@stackpress/ink/dist/client/Registry';
    source.addImportDeclaration({
      moduleSpecifier: '@stackpress/ink/dist/client/Registry',
      defaultImport: 'ClientRegistry'
    });
    //import ClientComponent from '@stackpress/ink/dist/client/Component';
    source.addImportDeclaration({
      moduleSpecifier: `@stackpress/ink/dist/client/${field ? 'Field' : 'Component'}`,
      defaultImport: field ? 'ClientField' : 'ClientComponent'
    });
    //import Counter from './Counter'
    this._component.components.filter(
      //template is already added to markup
      component => component.type !== 'template'
    ).forEach(component => {
      //now import
      source.addImportDeclaration({
        moduleSpecifier: component.source,
        //we make sure there's no collisions
        //this is also matched when generating the component tree
        defaultImport: component.classname
      });
    });
    //import others from <script>
    imports.forEach(imported => {
      if (imported.default && imported.names) {
        source.addImportDeclaration({
          isTypeOnly: imported.typeOnly,
          moduleSpecifier: imported.source,
          defaultImport: imported.default,
          namedImports: imported.names
        });
      } else if (imported.default) {
        source.addImportDeclaration({
          isTypeOnly: imported.typeOnly,
          moduleSpecifier: imported.source,
          defaultImport: imported.default
        });
      } else if (imported.names) {
        source.addImportDeclaration({
          isTypeOnly: imported.typeOnly,
          moduleSpecifier: imported.source,
          namedImports: imported.names
        });
      }
    });
    //export default class FoobarComponent extends InkComponent
    const component = source.addClass({
      name: classname,
      extends: field ? 'ClientField' : 'ClientComponent',
      isDefaultExport: true,
    });
    //public static id = 'abc123';
    component.addProperty({
      name: 'id',
      isStatic: true,
      initializer: `'${id}'`
    });
    //public static tagname = 'foo-bar';
    component.addProperty({
      name: 'tagname',
      isStatic: true,
      initializer: `'${tagname}'`
    });
    //public static classname = 'FoobarComponent_abc123';
    component.addProperty({
      name: 'classname',
      isStatic: true,
      initializer: `'${classname}'`
    });
    //public static observedAttributes = ["required", "value"]
    if (observe.length > 0) {
      component.addProperty({
        name: 'observedAttributes',
        isStatic: true,
        initializer: JSON.stringify(observe)
      });
    }
    //public style()
    component.addMethod({
      name: 'styles',
      returnType: 'string',
      statements: `return \`${styles.join('\n').trim()}\`;`
    });
    //public template()
    component.addMethod({
      name: 'template',
      statements: `${scripts.length > 0 
        ? scripts.join('\n')
        //allow scriptless components to use props
        : (`
          const props = this.props; 
          const children = () => this.originalChildren;
        `)}
        return () => ${this.markup.trim()};`
    });

    return source;
  }

  /**
   * API to create a ts-morph source file
   */
  protected _createSourceFile(filePath: string) {
    const project = new Project(this._config);
    const source = project.createSourceFile(filePath);
    return { project, source };
  }

  /**
   * Transforms markup to JS for the template() function
   */
  protected _markup(
    parent: MarkupToken|null,
    markup: MarkupChildToken[], 
    components: Component[]
  ): string {
    return "[\n" + markup.map(child => {
      let expression = '';
      if (child.type === 'MarkupExpression') {
        if (this._directives.has(child.name)) {
          const directive = this._directives.get(child.name) as DirectiveInterface;
          return directive.markup(parent, child, components, this._markup.bind(this));
        }
        //syntax <div title="Some Title">...</div>
        expression += this._markupElement(expression, parent, child, components);
      } else if (child.type === 'Literal') {
        if (typeof child.value === 'string') {
          if (child.escape) {
            expression += `ClientRegistry.createText(\`${child.value}\`, true)`;
          } else {
            expression += `ClientRegistry.createText(\`${child.value}\`, false)`;
          }
        //null, true, false, number 
        } else {
          expression += `ClientRegistry.createText(String(${child.value}))`;
        }
      } else if (child.type === 'ProgramExpression') {
        expression += `...this._toNodeList(${child.source})`;
      }
      return expression;
    }).join(", \n") + "\n]";
  }

  /**
   * Generates the markup for a standard element
   */
  protected _markupAttributes(attributes: ObjectToken) {
    return attributes.properties.map(property => {
      if (property.value.type === 'Literal') {
        if (typeof property.value.value === 'string') {
          return `'${property.key.name}': \`${property.value.value}\``;
        }
        //null, true, false, number 
        return `'${property.key.name}': ${property.value.value}`;
      } else if (property.value.type === 'ObjectExpression') {
        return `'${property.key.name}': ${
          JSON.stringify(Parser.object(property.value))
            .replace(/"([a-zA-Z0-9_]+)":/g, "$1:")
            .replace(/"\${([a-zA-Z0-9_]+)}"/g, "$1")
        }`;
      } else if (property.value.type === 'ArrayExpression') {
        return `'${property.key.name}': ${
          JSON.stringify(Parser.array(property.value))
            .replace(/"([a-zA-Z0-9_]+)":/g, "$1:")
            .replace(/"\${([a-zA-Z0-9_]+)}"/g, "$1")
        }`;
      } else if (property.value.type === 'Identifier') {
        if (property.spread) {
          return `...${property.value.name}`;
        }
        return `'${property.key.name}': ${
          property.value.name
        }`;
      } else if (property.value.type === 'ProgramExpression') {
        return `'${property.key.name}': ${
          property.value.source
        }`;
      }

      return false;
    }).filter(Boolean).join(', ');
  }

  /**
   * Generates the markup for a standard element
   */
  protected _markupElement(
    expression: string, 
    parent: MarkupToken|null,
    token: MarkupToken,
    components: Component[]
  ) {
    //check to see if the token refers to a component imported by this file
    const component = components.find(
      component => component.tagname === token.name
    );
    //if the token refers to a component imported by 
    //this file and the component is tokenizable
    if (component && component.type !== 'external') {
      if (component.type === 'template') {
        //templates take no children and scope is 
        //the same as the parent scope. template
        //tags are simply replaced with its children
        //syntax <x-head />
        //NOTE: if you want scoped templates, 
        // that's the same as a light component
        return expression + `...${this._markup(
          parent,
          component.ast.markup, 
          components
        )}`;
      }
      //business as usual
      const classname = component.classname;
      const tagname = component.brand 
        ? `${component.brand}-${component.tagname}`
        : component.tagname;

      expression += `ClientRegistry.createComponent('${tagname}', ${classname}, {`;
    //this is a tag that is not a component/template
    } else {
      expression += `ClientRegistry.createElement('${token.name}', {`;
    }
    
    if (token.attributes && token.attributes.properties.length > 0) {
      expression += ' ' + this._markupAttributes(token.attributes);
    }
    if (token.kind === 'inline') {
      expression += ' }).element';
    } else {
      expression += ' }, ';
      if (token.children) {
        expression += this._markup(token, token.children, components);
      }
      expression += `).element`;
    }
    
    return expression;
  }
}