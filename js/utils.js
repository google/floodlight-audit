/***************************************************************************
*
*  Copyright 2021 Google Inc.
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*      https://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*
*  Note that these code samples being shared are not official Google
*  products and are not formally supported.
*
***************************************************************************/

/**
 * This module contains several useful functions applicable to several of the
 * modules of the application
 */

/**
 * Cleans url to avoid duplication
 *
 * params:
 *  url string url to scrub
 *
 * returns: clean url, without query string parameters or trailing slashes
 */
function scrubUrl(url) {
  var cleanUrl = decodeURI(url);

  // remove url params to reduce duplication
  cleanUrl = cleanUrl.replace(/[\?|#].*$/, '');

  // remove trailing '/' character from urls, reduce duplication
  cleanUrl = cleanUrl.replace(/\/$/, '');

  return cleanUrl;
}

/**
 * Parses a query string parameter by name from the URL
 *
 * params: name String, name of the parameter to parse
 *
 * returns: value of the parameter
 */
$.urlParam = function(name){
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
  return results[1] || 0;
};

/**
 * Promisifying javascript setTimeout function
 */
function wait(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, timeout);
  });
}

/**
 * Generates unique identifier
 */
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

/**
 * Downloads a file to the user
 *
 * params:
 *  fileName: string with the default file name
 *  content: string content of the file
 */
function download(fileName, content) {
  var downloadLink = document.createElement("a");
  var file_blob = new Blob(["\ufeff", content]);
  var url = URL.createObjectURL(file_blob);
  downloadLink.href = url;
  downloadLink.download = fileName;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

/**
 * Constructs a URL with gclid for validating global site tags
 *
 * params:
 *  url: the base url
 *  includeParams: whether to include gclid params in the generated URL
 *
 * returns: constructed URL
 *
 * TODO: this should probably be a method inside GlobalSiteTagVerification, and
 * the gclid and gclsrc should be constructor parameters
 */
function constructUrl(url, includeUserParams) {
  if(!url) return;
  var newUrl = url;
  var parameters = [];
  if (includeUserParams) {
    var gclidValue = $('#gclid').text();
    var gclsrcValue = $('#gclsrc').text();

    if(gclidValue !== '') parameters.push(`gclid=${gclidValue}`);
    if(gclsrcValue !== '') parameters.push(`gclsrc=${gclsrcValue}`);
  }
  var urlsuffix = $('#urlsuffix').val();
  if(urlsuffix !== '' && !newUrl.includes(urlsuffix)) {
    parameters.push(`${urlsuffix.replace(/^\?/, '')}`);
  }
  if(parameters.length > 0) {
    if(newUrl.match(/\?/)) {
      newUrl += `&${parameters.join('&')}`;
    } else {
      newUrl += `?${parameters.join('&')}`;
    }
  }
  return newUrl;
}

/**
 * Updates monitor when behavior changes
 */
function updateBehavior() {
  chrome.webRequest.handlerBehaviorChanged(() => {
    console.log('Web request handler behavior has been changed, clearing cache.');
  });
}

