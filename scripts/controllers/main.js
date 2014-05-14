'use strict';

angular.module('sortinghatApp')
  .controller('MainCtrl', function ($scope, $timeout, data, mySession) {
    var M = this
      ;

    M.message = "This is bound scope, accessed as 'M.message' in templates and 'message' will not leak between scopes";
    $scope.message = "This is unbound scope, accessed as 'message' in this and child scopes";

    // These resources will take some time to resolve.
    // If the page remains blank without error messages, throw the blame at one of these and check that they resolve

    // Always a guest or null, at the least
    M.session = mySession;

    // Some data provided by the data service
    M.data = data;
  });