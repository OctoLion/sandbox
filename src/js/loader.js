'use strict';

var $ = require('jquery');
var URI = require('urijs');
var Cookies = require('js-cookie');

// Enum that documents the various deployment environments.
var Environment = {
  PRODUCTION: 0,
  PULL_REQUEST: 1,
  LOCAL_DEVELOPMENT: 2
};

var productionHost = 'www.kylesandbox.nationbuilder.com';
var localDevHost = 'localhost:3902';
var pullRequestHostRegex = /^kylesandbox-pr-\d+\.herokuapp\.com$/;

// Determine the current deployment environment by examining the current
// hostname running this script.
var currentUri = new URI();
var currentHost = currentUri.host();
var currentEnvironment;
if (localDevHost == currentHost) {
  currentEnvironment = Environment.LOCAL_DEVELOPMENT;
} else if (productionHost == currentHost) {
  currentEnvironment = Environment.PRODUCTION;
} else if (pullRequestHostRegex.test(currentHost)) {
  currentEnvironment = Environment.PULL_REQUEST;
} else {
  throw "Unknown environment!";
}

// Check for a "dev" query var and if it is set to a whitelisted value then we
// set a cookie with a short expiry time which is used to pull in assets
// from a local development or pull-request environment.
var cookieName = 'dev';
var prRegex = /^pr-\d+$/;
var devQueryVar = currentUri.search(true)['dev'];
// Whitelist accepted values for the dev query var for security.
if ('prod' === devQueryVar || 'true' === devQueryVar || true === prRegex.test(devQueryVar)) {
  Cookies.set(cookieName, devQueryVar, {
    expires: 1 / 48
  });
} else if ('false' === devQueryVar) {
  Cookies.remove(cookieName);
}

// If a dev cookie is set, interpret it to determine what deployment environment
// we want to target.
var cookieValue = Cookies.get(cookieName);
var ghpagesBaseUrl = 'kylesandbox';
var baseUrl = Environment.PRODUCTION === currentEnvironment ? ghpagesBaseUrl :
  currentUri.origin();
var targetBaseUrl, targetEnvironment;
if (cookieValue == 'true') {
  targetEnvironment = Environment.LOCAL_DEVELOPMENT;
  targetBaseUrl = 'https://' + localDevHost;
} else if (true === prRegex.test(cookieValue)) {
  targetEnvironment = Environment.PULL_REQUEST;
  targetBaseUrl = 'https://kylesandbox-' + cookieValue + '.herokuapp.com';
} else if (null == cookieValue && currentEnvironment !== Environment.PRODUCTION) {
  targetEnvironment = currentEnvironment;
  targetBaseUrl = baseUrl;
} else {
  targetEnvironment = Environment.PRODUCTION;
  targetBaseUrl = ghpagesBaseUrl;
}

// Dynamically load the main js bundle depending upon which environment we're
// targeting.
var mainScripts = ['/js/bundle.js'];
mainScripts.forEach(function (scriptPath) {
  // $.ajax will append the script automatically for dataType: 'script'
  // requests. The cache: true setting is essential, since otherwise jQuery will
  // append a timestamp-based cache-busting url param to the request and bypass
  // browser caching.
  $.ajax({
    url: targetBaseUrl + scriptPath,
    dataType: 'script',
    cache: true
  });
})

if (currentEnvironment === Environment.PRODUCTION &&
    currentEnvironment !== targetEnvironment) {
  $(document).ready(function () {
    // Search for style, img, video and other tags that point to ghpages and
    // replace them with the target environment. This allows us to test
    // images, stylesheets and other elements that are hosted in our repo.
    $('[src^="' + ghpagesBaseUrl + '"], [href^="' + ghpagesBaseUrl + '"]').each(function () {
      var $element = $(this);
      var attributeName = $element.is('[src]') ? 'src' : 'href';
      var attributeValue = $element.attr(attributeName);
      var newUrl = attributeValue.replace(ghpagesBaseUrl, targetBaseUrl);

      // We replace the tag we're updating to ensure that it reloads in all
      // browsers.
      var $newElement = $element.clone();
      $newElement.attr(attributeName, newUrl);
      $element.replaceWith($newElement);

      // If we replace a video source element we need to tell the video
      // element to reload the video, otherwise it won't play the new video.
      if ($newElement.parent().is('video')) {
        $newElement.parent().load();
      }
    });

    // Add a fixed notice to the bottom of the browser so that developers know
    // when they're targeting a dev environment.
    $('<div class="dev-notice">Dev Mode: using ' + targetBaseUrl + '</div>')
      .css({
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgb(243, 98, 98)',
        color: 'white',
        padding: '10px',
        zIndex: '1000',
        textAlign: 'center',
      })
      .appendTo('body');
  });
}
