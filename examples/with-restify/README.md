# 💧 Ink - Restify Example

Boilerplate using Restify and Ink as a template engine.

## Integration Example

```js
import path from 'path';
import restify from 'restify';
import { document } from '@stackpress/ink/server';

const cwd = path.dirname(__dirname);

//general options for ink
const template = document({
  buildFolder: './.ink',
  cwd: cwd,
  useCache: false
});

var server = restify.createServer();
server.get('/', async (req, res, next) => {
  const render = await template('./templates/page.ink');
  const results = render({
    title: 'Ink',
    description: 'Edit this file to change the content of the page.',
    start: 0,
    list: [
      'Edit this file',
      'Restyle this page',
      'Create your own component',
      'Star the Ink Repo',
      'Write a blog post about Ink',
      'Fork the respository',
      'Contribute to the project'
    ]
  });
  //res.contentType = 'text/html';
  res.end(results);
  next();
});

server.get(
  '/*', 
  restify.plugins.serveStaticFiles(
    path.join(cwd, 'public')
  )
); 

server.listen(8080, function() {
  console.log('%s listening at %s', server.name, server.url);
});
```