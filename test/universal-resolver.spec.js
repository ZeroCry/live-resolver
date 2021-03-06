const assert = require('assert');
const sinon = require('sinon');
require('sinon-as-promised');
const got = require('got');
const cache = require('memory-cache');
const hapi = require('hapi');
const resolverPlugin = require('../src/plugins/universal-resolver.js');

describe('resolver', () => {
  let server;
  const options = {
    method: 'GET',
    url: '/q/bower/foo',
  };

  before((done) => {
    server = new hapi.Server();
    server.connection();

    server.register(resolverPlugin, () => {
      server.start(() => {
        done();
      });
    });
  });

  after((done) => {
    server.stop(() => done());
  });

  beforeEach(() => {
    this.sandbox = sinon.sandbox.create();
    this.gotStub = this.sandbox.stub(got, 'get');

    this.sandbox.stub(cache, 'get');
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe('fetch', () => {
    it('returns an error if registry fetch fails', (done) => {
      const err = new Error('Some error');
      this.gotStub.rejects(err);

      server.inject(options, (response) => {
        assert.equal(response.statusCode, 500);
        assert.equal(response.result.error, 'Internal Server Error');
        done();
      });
    });

    it('fetch package information from registry', (done) => {
      this.gotStub.resolves();

      server.inject(options, () => {
        assert.equal(this.gotStub.callCount, 1);
        assert.equal(this.gotStub.args[0][0], 'https://registry.bower.io/packages/foo');
        done();
      });
    });

    it('escapes slashes in package names', (done) => {
      const optionsScopePackage = {
        method: 'GET',
        url: '/q/npm/@angular/core',
      };

      this.gotStub.resolves();

      server.inject(optionsScopePackage, () => {
        assert.equal(this.gotStub.callCount, 1);
        assert.equal(this.gotStub.args[0][0], 'https://registry.npmjs.org/@angular%2fcore');
        done();
      });
    });
  });

  describe('response', () => {
    describe('with 404', () => {
      it('when package can not be found', (done) => {
        const err = new Error('Some error');
        err.code = 404;
        this.gotStub.rejects(err);

        server.inject(options, (response) => {
          assert.equal(response.statusCode, 404);
          assert.equal(response.result.message, 'Package not found');
          done();
        });
      });
    });

    describe('with 200', () => {
      it('when no repository url is found', (done) => {
        this.gotStub.resolves({
          body: JSON.stringify({
            url: '',
          }),
        });

        server.inject(options, (response) => {
          assert.equal(response.statusCode, 200);
          assert.equal(response.result.url, 'https://bower.io/search/?q=foo');
          done();
        });
      });
    });
  });
});
