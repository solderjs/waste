'use strict';

// TODO move into config
window.Stripe.setPublishableKey('pk_test_526DRmZwEOiMxTigV5fX52ti');

angular.module('yololiumApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'duScroll',
  'ui.router',
  'ui.bootstrap'
])
  .config(function ($stateProvider, $urlRouterProvider/*, StApi*/) {
    var nav
      , footer
      ;

    // This identifies your website in the createToken call
    //window.Stripe.setPublishableKey(StApi.stripe.publicKey);

    // IMPORTANT: (Issue #4)
    // These funny arrays (in resolve) are neccessary because ui.router
    // doesn't get properly mangled by ng-min
    // See https://github.com/yeoman/generator-angular#minification-safe
    nav = {
      templateUrl: '/views/nav.html'
    , controller: 'NavCtrl as N'
    , resolve: {
        mySession: ['StSession', function (StSession) {
          return StSession.get();
        }]
      }
    };

    footer = {
      templateUrl: '/views/footer.html'
    };

    //$locationProvider.html5Mode(true);

    // Deal with missing trailing slash
    $urlRouterProvider.rule(function($injector, $location) {
      var path = $location.path(), search = $location.search()
        ;

      if (path[path.length - 1] === '/') {
        return;
      }

      if (Object.keys(search).length === 0) {
        return path + '/';
      }

      var params = []
        ;

      angular.forEach(search, function(v, k){
        params.push(k + '=' + v);
      });

      return path + '/?' + params.join('&');
    });
    $urlRouterProvider.otherwise('/');

    $stateProvider
      .state('root', {
        url: '/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/main.html'
          , controller: 'MainCtrl as M'
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            , data: ['Data', function (Data) {
                return Data.get();
              }]
            }
          }
        , footer: footer
        }
      })
      // This is the root state for not-logged-in users
      .state('splash', {
        url: '/splash/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/splash.html'
          , controller: 'SplashCtrl as S'
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            }
          }
        , footer: footer
        }
      })
      .state('user', {
        url: '/user/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/user.html'
          , controller: 'UserCtrl as U'
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            }
          }
        , footer: footer
        }
      })
      .state('admin', {
        url: '/admin/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/admin.html'
          , controller: 'AdminCtrl as A'
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            }
          }
        , footer: footer
        }
      })
      .state('account', {
        url: '/account/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/account.html'
          , controller: "AccountCtrl as A"
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            }
          }
        , footer: footer
        }
      })
      .state('store', {
        url: '/store/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/store.html'
          , controller: "StoreCtrl as S"
          , resolve: {
              mySession: ['StSession', function (StSession) {
                return StSession.get();
              }]
            }
          }
        , footer: footer
        }
      })
      .state('lds', {
        parent: 'main'
      })
      .state('weddings', {
        parent: 'main'
      , url: 'weddings/'
      })
      .state('about', {
        parent: 'main'
      })
      .state('privacy', {
        parent: 'main'
      })
      /*
      , {
        url: '/about/'
      , views: {
          nav: nav
        , body: {
            templateUrl: 'views/about.html'
          }
        , footer: footer
        }
      })
      */
      ;
  });
