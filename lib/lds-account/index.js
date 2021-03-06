'use strict';

var PromiseA = require('bluebird').Promise;
var path = require('path');
var fs = PromiseA.promisifyAll(require('fs'));
var config = require('./config');
var passthru = require('./passthru-client').create(config);
var request = require('request');
var requestAsync = PromiseA.promisify(request);
var localLdsMobileApi = path.join(__dirname, 'lds-config.json');
var ldsMobileApiUrl = 'https://tech.lds.org/mobile/ldstools/config.json';
var ldsMobileApi;

function getConfig() {
  if (ldsMobileApi) {
    return PromiseA.resolve(ldsMobileApi);
  }

  return requestAsync({ url: ldsMobileApiUrl }).spread(function (resp, body) {
    var json = JSON.parse(body);

    ldsMobileApi = json;

    if (json['auth-url']) {
      return fs.writeFileAsync(localLdsMobileApi, body, 'utf8');
    } else {
      return fs.readFileAsync(localLdsMobileApi, 'utf8').then(function (body) {
        ldsMobileApi = JSON.parse(body);
      });
    }
  }).then(function () {
    // TODO move mixed cases / dashes / underscores all to camelCase
    return ldsMobileApi;
  });
}

function testSession(session) {
  var results = {};
  var jarObj;

  return getConfig().then(function (/*ldsMobileApi*/) {
    var JarSON = require('jarson');
    jarObj = JarSON.fromJSON(session.jar);

    results.token = session.token;
    results.jar = session.jar;

    return requestAsync({
      //url: 'https://www.lds.org/directory/services/ludrs/mem/current-user-info/'
      url: ldsMobileApi['current-user-detail']
    , jar: jarObj
    , gzip: true
    }).spread(function (resp, body) {
      var user = JSON.parse(body);

      results.user = user;
    });
  }).then(function () {
    var units = require('./basic').getDetails(results.user);
    console.log('\n\n');
    console.log(units);
    console.log('\n\n');

    return PromiseA.all([
      requestAsync({
        url: ldsMobileApi['unit-members-and-callings-v2'].replace(/%@/, results.user.homeUnitNbr)
      , jar: jarObj
      , gzip: true
      }).spread(function (resp, body) {
        results.ward = JSON.parse(body);
      })
    , requestAsync({
        url: "https://www.lds.org/maps/services/search?query=%@&lang=eng"
          .replace(/%@/, encodeURIComponent(units.ward.name.split(/\s+/).shift() + ' ' + units.ward.id))
      , gzip: true
      }).spread(function (resp, body) {
        var listing = JSON.parse(body);
        var type;
        var url;

        console.log(encodeURIComponent(units.ward.name + ' ' + units.ward.id));
        listing.some(function (item) {
          console.log('ward item');
          console.log(item);
          if (item.id && item.id.toString() === units.ward.id.toString()) {
            type = item.type;
            return true;
          }
        });

        if (!type) {
          return null;
        }

        units.ward.type = type;
        url = "https://www.lds.org/maps/services/layers/details?id=%@&layer=%@&lang=eng"
            .replace(/%@/, encodeURIComponent(units.ward.id))
            .replace(/%@/, encodeURIComponent(units.ward.type))
            ;
        return requestAsync({
          url: url 
        , gzip: true
        }).spread(function (resp, body) {
          try {
            results.meetinghouse = JSON.parse(body);
          } catch(e) {
            results.meetinghouse = {};
            console.error('meetinghouse', url);
            console.error(body);
          }
        });
      })
    , requestAsync({
        url: "https://www.lds.org/maps/services/search?query=%@&lang=eng"
          .replace(/%@/, encodeURIComponent(units.stake.name.split(/\s+/).shift() + ' ' + units.stake.id))
      , gzip: true
      }).spread(function (resp, body) {
        var listing = JSON.parse(body);
        var type;
        var url;

        listing.some(function (item) {
          console.log('stake item');
          console.log(item);
          if (item.id && (item.id.toString() === units.stake.id.toString())) {
            type = item.type;
            return true;
          }
        });

        if (!type) {
          return null;
        }

        units.stake.type = type;
        url = "https://www.lds.org/maps/services/layers/details?id=%@&layer=%@&lang=eng"
            .replace(/%@/, encodeURIComponent(units.stake.id))
            .replace(/%@/, encodeURIComponent(units.stake.type))
            ;
        return requestAsync({
          url: url
        , gzip: true
        }).spread(function (resp, body) {
          try {
            results.stakecenter = JSON.parse(body);
          } catch(e) {
            results.stakecenter = {};
            console.error('stakecenter', url);
            console.error(body);
          }
        });
      })
    ]);
  }) 
  /*.then(function () {
    return requestAsync({
      url: ldsMobileApi['callings-with-dates'].replace(/%@/, results.user.homeUnitNbr)
    , jar: jarObj
    , gzip: true
    }).spread(function (resp, body) {
      console.log('callings-with-dates');
      console.log(body);
      try {
        var callings = JSON.parse(body);
        results.callings = callings;
      } catch(e) {
        results.callingsError = body;
      }
    });
  }).then(function () {
    return requestAsync({
      url: ldsMobileApi['membership-record'].replace(/%@/, results.user.individualId)
    , jar: jarObj
    , gzip: true
    }).spread(function (resp, body) {
      console.log('membership-record');
      console.log(body);
      try {
        var callings = JSON.parse(body);
        results.record = callings;
      } catch(e) {
        results.recordError = body;
      }
    });
  })*/.then(function () {
    var profile = require('./basic').getDirectory(results.user, results.ward);
    //console.log(Object.keys(profile));
    Object.keys(profile).forEach(function (key) {
      results[key] = profile[key];
    });

    // { me: ..., callings: ..., stakes: ..., wards: ..., leaders: ..., individuals: ..., homes: ...
    // , token: session.token, jar: session.jar, user: user, ward: ward };
    return results;
  });
}

function check(opts) {
  return passthru(opts).then(function (body) {
    if (body.error) {
      console.error('Error with login');
      console.error(body.error);
      return PromiseA.reject(body.error);
    }

    console.log(body);
    if (!body.jar) {
      return PromiseA.reject(new Error("bad credentials"));
    }

    return body;
  });
}

function checkUserPass(username, password) {
  return check({ username: username, password: password });
}

/*
function checkToken(token) {
  return check({ token: token });
}
*/

function run(secrets) {
  return checkUserPass(secrets.username, secrets.password).then(function (body) {
    return testSession(body).then(function (session) {
      return session;
    });
  })/*.then(function (body) {
    return checkToken(body.token).then(function (body) {
      return testSession(body.jar).then(function () {
        return body;
      });
    });
  })*/;
}

function getNewSession(token) {
  return passthru({ token: token }).then(function (body) {
    if (body.error) {
      return PromiseA.reject(body.error);
    }

    if (!body.jar) {
      return PromiseA.reject(new Error("bad credentials"));
    }

    return body;
  });
}

module.exports.login = run;
module.exports.api = {};

// This crazy wrapper automatically retries to exchange the token for a new session
// if the session is expired and hands the new session back to the caller with a  warning
function wrapApiWithRetry(api) {
  module.exports[api] = function () {
    var args = Array.prototype.slice.call(arguments);
    var ldsAccount = args[0];

    return getConfig().then(function (ldsMobileApi) {
      args.unshift(ldsMobileApi);

      function retry(opts, result) {
        if (opts.tried) {
          console.error(result);
          return PromiseA.reject(new Error("login expired and cannot be renewed with token (new login required)"));
        }
        return getNewSession(ldsAccount.token).then(function (session) {
          console.log('[LDS LOGIN RETRY]', session);
          if (session.token) {
            ldsAccount.token = session.token;
          }
          ldsAccount.jar = session.jar;
          return makeRequest({ tried: true });
        });
      }

      function makeRequest(opts) {
        args[1] = ldsAccount.jar;
        return module.exports.api[api].apply(null, args).then(function (result) {
          if ('object' !== typeof result) {
            return retry(opts, result);
          }

          // TODO check session staleness
          return {
            result: result
          , jar: ldsAccount.jar
          , token: ldsAccount.token
          , warning: opts.tried && { message: "login expired and was renewed with token" }
          };
        }).catch(function (err) {
          // TODO more specific error test (maybe a code like 'E_SESSION_EXPIRED'?)
          if (/session/.test(err.message)) {
            return retry(opts);
          }

          throw err;
        });
      }

      return makeRequest({ tried: false });
    });
  };
}

['profile'].forEach(wrapApiWithRetry);

function callApi(thingy) {
  var opts = {
    //url: 'https://www.lds.org/directory/services/ludrs/mem/current-user-info/'
    url: thingy.url
  , gzip: true
  };

  if (thingy.jar) {
    opts.jar = require('jarson').fromJSON(thingy.jar);
  }

  return requestAsync(opts).spread(function (resp, body) {
    try {
      return JSON.parse(body);
    } catch(e) {
      console.error('[ERROR] callApi');
      console.error('thingy.url', thingy.url);
      if (opts.jar) {
        console.error('thingy.jar', JSON.stringify(thingy.jar));
        console.error('opts.jar', opts.jar);
      }
      console.error(typeof body);
      console.error(body);
      console.error(e);
      if (opts.jar) {
        return PromiseA.reject(new Error("could not parse result (session may have expired and returned html in redirect)"));
      } else {
        return PromiseA.reject(new Error("could not parse result (might be an lds.org error)"));
      }
    }
  });
}

module.exports.api.profile = function (ldsMobileApi, jar/*, opts*/) {
  var results = {};

  return callApi({
    jar: jar
  , url: ldsMobileApi['current-user-detail']
  }).then(function (body) {
    results.user = body;
  }).then(function () {
    var units = require('./basic').getDetails(results.user);
    var stakeSearchUrl = "https://www.lds.org/maps/services/search?query=%@&lang=eng"
          .replace(/%@/, encodeURIComponent(units.stake.name.split(/\s+/).shift() + ' ' + units.stake.id));
    var wardSearchUrl = "https://www.lds.org/maps/services/search?query=%@&lang=eng"
          .replace(/%@/, encodeURIComponent(units.ward.name.split(/\s+/).shift() + ' ' + units.ward.id));

    return PromiseA.all([
      callApi({
        url: ldsMobileApi['unit-members-and-callings-v2'].replace(/%@/, results.user.homeUnitNbr)
      , jar: jar
      }).then(function (body) {
        results.ward = body;
      })
    , callApi({
        url: wardSearchUrl 
      }).then(function (listing) {
        var type;
        var url;

        listing.some(function (item) {
          if (item.id && item.id.toString() === units.ward.id.toString()) {
            type = item.type;
            return true;
          }
        });

        if (!type) {
          return null;
        }

        units.ward.type = type;
        url = "https://www.lds.org/maps/services/layers/details?id=%@&layer=%@&lang=eng"
            .replace(/%@/, encodeURIComponent(units.ward.id))
            .replace(/%@/, encodeURIComponent(units.ward.type))
            ;
        return callApi({
          url: url
        }).then(function (body) {
          results.meetinghouse = body;
        }).catch(function (e) {
          console.error("[ERROR] WARD MAP");
          console.error(wardSearchUrl);
          console.error(url);
          console.error(e);
          results.stakecenter = {};
        });
      })
    , callApi({
        url: stakeSearchUrl
      }).then(function (listing) {
        var type;
        var url;

        listing.some(function (item) {
          if (item.id && (item.id.toString() === units.stake.id.toString())) {
            type = item.type;
            return true;
          }
        });

        if (!type) {
          return null;
        }

        units.stake.type = type;
        url = "https://www.lds.org/maps/services/layers/details?id=%@&layer=%@&lang=eng"
            .replace(/%@/, encodeURIComponent(units.stake.id))
            .replace(/%@/, encodeURIComponent(units.stake.type))
            ;
        return callApi({
          url: url 
        }).then(function (stakecenter) {
          results.stakecenter = stakecenter;
        }).catch(function (e) {
          console.error("[ERROR] STAKE MAP");
          console.error(stakeSearchUrl);
          console.error(url);
          console.error(e);
          results.stakecenter = {};
        });
      })
    ]);
  }).then(function () {
    var profile = require('./basic').getDirectory(results.user, results.ward);
    //console.log(Object.keys(profile));
    Object.keys(profile).forEach(function (key) {
      results[key] = profile[key];
    });

    // { me: ..., callings: ..., stakes: ..., wards: ..., leaders: ..., individuals: ..., homes: ...
    // , home: ...
    // , token: session.token, jar: session.jar, user: user, ward: ward };
    var me = results.me;
    var units = require('./basic').getDetails(results.user);
    return {
      result: {
        individualId: me.individualId || me.id
      , name: me.name
      , givennames: me.givennames
      , surnames: me.surnames
      , phones: me.phones
      , emails: me.emails
      , home: me.home

      , homeWardId: units.ward.id
      , homeStakeId: units.stake.id
      , callings: results.callings
      , callingWards: results.wards
      , callingStakes: results.stakes

      // TODO wards and stakes
      }
    };
  });
};
