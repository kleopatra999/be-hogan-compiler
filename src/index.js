const Hogan = require('assets-require/hogan');

class HoganCompiler {
  constructor(readFile, templatesPath, options = {}) {
    this._lambdas = {};
    this._templatePromises = {};

    const readTemplate = (name) => {
      return readFile(`${templatesPath}/${name}.${options.extension || 'mustache'}`)
      .then(file => Hogan.compile(file));
    };

    const readCachedTemplate = (name) => {
      let templatePromise = this._templatePromises[name];
      if (!templatePromise) {
        this._templatePromises[name] = templatePromise = readTemplate(name);
      }
      return templatePromise;
    };

    this._readTemplate = options.isCached ? readCachedTemplate : readTemplate;
  }

  addLambda(name, lambda) {
    this._lambdas[name] = lambda;
  }

  compile(name) {
    return this._readTemplate(name)
    .then(template => {
      return this._readPartials(name, template)
      .then((requiredPartials) => {
        const lambdas = this._lambdas;

        // render internal - hook that Hogan.js designed for overrides
        template.ri = function(context, partials, indent) {
          context.unshift(lambdas);
          return this.r(context, Object.assign({}, requiredPartials, partials), indent);
        };

        return template;
      });
    });
  }

  _readPartials(name, template, partials = {}) {
    partials[name] = template;

    const partialNames = Object.keys(template.partials)
    .map(id => template.partials[id].name)
    .filter(name => !Boolean(partials[name]));

    const templatePromises = partialNames
    .map(name => this._readTemplate(name));

    return Promise.all(templatePromises)
    .then(templates =>
      Promise.all(templates.map((template, idx) =>
        this._readPartials(partialNames[idx], template, partials)
      ))
    )
    .then(() => partials);
  }
}

exports.create = function(readFile, templatesPath, options) {
  return new HoganCompiler(readFile, templatesPath, options);
};