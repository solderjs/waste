'use strict';

var connect = require('connect')
  , path = require('path')
  , app = connect()
  , auth = require('./auth')
  , config = require('./config')
  , ws = require('./lib/ws')
  , wsport = config.wsport || 8282
  , routes
  ;

if (!connect.router) {
  connect.router = require('connect_router');
}

// Generic API routes
function route(rest) {
  function getPublic(reqUser) {
    if (!reqUser) {
      return null;
    }
    return {
      // TODO current account
      currentLoginId: reqUser.currentUser.id
    , accounts: reqUser.accounts
    , profiles: reqUser.profiles.map(function (authN) { authN.profile.pkey = authN.id; return authN.profile; })
    };
  }

  rest.get('/api/session', function (req, res) {
    res.send(getPublic(req.user) || { role: 'guest', as: 'get' });
  });
  // this is the fallthrough from the POST '/api' catchall
  rest.post('/api/session', function (req, res) {
    res.send(getPublic(req.user) || { role: 'guest', as: 'post' });
  });
  rest.post('/api/session/:type', function (req, res) {
    res.send(getPublic(req.user) || { role: 'guest', as: 'post', type: req.params.type });
  });
  rest.delete('/api/session', function (req, res) {
    req.logout();
    res.send({ role: 'guest', as: 'delete' });
  });
}

app
  .use(connect.logger())
  .use(connect.errorHandler({ dumpExceptions: true, showStack: true }))
  .use(connect.query())
  .use(connect.json())
  .use(connect.urlencoded())
  .use(connect.compress())
  .use(connect.cookieParser())
  .use(connect.session({ secret: config.sessionSecret }))
  .use(require('./connect-shims/redirect'))
  .use(require('./connect-shims/send'))
  //.use(express.router)
  ;
  //route(app);

//
// Generic Template Auth
//
routes = auth.init(app, config);
routes.forEach(function (fn) {
  app.use(connect.router(fn));
});

//
// App-Specific WebSocket Server
//
app.use(connect.router(ws.create(app, wsport, [])));

//
// Generic Template API
//
app
  .use(connect.router(route))
  .use(require('connect-jade')({ root: __dirname + "/views", debug: true }))
  .use(connect.static(path.join(__dirname, 'data')))
  //.use(connect.static(path.join(__dirname, 'dist')))
  //.use(connect.static(path.join(__dirname, '.tmp', 'concat')))
  .use(connect.static(path.join(__dirname, 'app')))
  .use(connect.static(path.join(__dirname, '.tmp')))
  .use(function (req, res, next) {
    console.info("Actual req.url:");
    console.info(req.url);
    next();
  })
  ;

module.exports = app;
