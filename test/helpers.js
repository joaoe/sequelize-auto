const Sequelize = require('sequelize');
const path = require('path');
const config = require(path.join(__dirname, 'config'));
const fs = require('fs');

module.exports = {
  Sequelize: Sequelize,

  initTests: function(options) {
    const sequelize = this.createSequelizeInstance(options);

    this.clearDatabase(sequelize, function() {
      if (options.context) {
        options.context.sequelize = sequelize;
      }
      if (options.beforeComplete) {
        options.beforeComplete(sequelize);
      }
      if (options.onComplete) {
        options.onComplete(sequelize);
      }
    });
  },

  createSequelizeInstance: function(options) {
    options = options || {};
    options.dialect = options.dialect || 'mysql';
    options.logging = options.hasOwnProperty('logging') ? options.logging : false;

    const sequelizeOptions = {
      logging: options.logging,
      dialect: options.dialect,
      host: config[options.dialect].host,
      port: config[options.dialect].port
    };

    if (config[options.dialect] && config[options.dialect].storage) {
      sequelizeOptions.storage = config[options.dialect].storage;
    }

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true;
    }

    if (process.env.DIALECT === 'mssql') {
      // set defaults for tedious, to silence the warnings
      sequelizeOptions.dialectOptions = { options: { trustServerCertificate: true, enableArithAbort: true }};
    }

    return new Sequelize(
      config[options.dialect].database,
      config[options.dialect].username,
      config[options.dialect].password,
      sequelizeOptions
    );
  },

  clearDatabase: function(sequelize, callback) {
    function success() {
      fs.readdir(config.directory, function(err, files) {
        if (err || !files || files.length < 1) {
          return callback && callback();
        }

        files.forEach(function(file) {
          const fileName = path.join(config.directory, file);
          const stat = fs.statSync(fileName);
          if (stat.isFile()) {
            fs.unlinkSync(fileName);
          }
        });
        callback && callback();
      });
    }

    function error(err) {
      throw err;
    }

    sequelize
      .getQueryInterface()
      .dropAllTables()
      .then(success, error);
  },

  getSupportedDialects: function() {
    return fs
      .readdirSync(path.join(__dirname, '..', 'node_modules', 'sequelize', 'lib', 'dialects'))
      .filter(function(file) {
        return file.indexOf('.js') === -1 && file.indexOf('abstract') === -1;
      });
  },

  getTestDialect: function() {
    let envDialect = process.env.DIALECT || 'mysql';
    if (envDialect === 'postgres-native') {
      envDialect = 'postgres';
    }

    if (this.getSupportedDialects().indexOf(envDialect) === -1) {
      throw new Error('The dialect you have passed is unknown. Did you really mean: ' + envDialect);
    }
    return envDialect;
  },

  getTestDialectTeaser: function(moduleName) {
    let dialect = this.getTestDialect();
    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native';
    }
    return `[${dialect.toUpperCase()}] ${moduleName}`;
  },

  checkMatchForDialects: function(dialect, value, expectations) {
    if (expectations.hasOwnProperty(dialect)) {
      expect(value).toMatch(expectations[dialect]);
    } else {
      throw new Error(`Undefined expectation for "${dialect}"!`);
    }
  }
};
