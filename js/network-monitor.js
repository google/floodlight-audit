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
 * Network monitor that capture traffic coming from the page
 *
 * params:
 *  tab: chrome tab being monitored
 *  urls: list of strings containing urls to monitor
 */
class NetworkMonitor {
  constructor(tab, urls) {
    // Target tab for monitoring
    this.tab = tab;
    // URLs to monitor
    this.urls = urls;
    // Capture event handler
    this._capture = null;
  }

  /**
   * Adds header to disable request cache
   *
   * params:
   *  details: Object representing the request configuration object
   */
  disableRequestCache = (details) => {
    var headers = details.requestHeaders || [];
    headers.push({
        "name": "Cache-Control",
        "value": "no-cache"
    });
    return {requestHeaders: headers};
  }

  /**
   * Fires a capture event
   */
  capture = (details) => {
    if(this._capture) {
      chrome.tabs.get(details.tabId, (tab) => {
        this._capture(tab.url, details);
      });
    }
  }

  /**
   * Starts the network monitor
   */
  start = () => {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.disableRequestCache, { "urls": this.urls });

    chrome.webRequest.onCompleted.addListener(
      this.capture, { "urls": this.urls });

    chrome.webRequest.onBeforeRedirect.addListener(
      this.capture, { "urls": this.urls });
  }

  /**
   * Stops the network monitor
   */
  stop = () => {
    chrome.webRequest.onBeforeSendHeaders.removeListener(this.disableRequestCache)
    //chrome.tabs.onUpdated.removeListener(passiveModeListener);
    chrome.webRequest.onCompleted.removeListener(this.capture);
    chrome.webRequest.onBeforeRedirect.removeListener(this.capture);
  }

  /**
   * Register the on capture event handler, which is invoked whenever a new
   * network call is captured
   *
   * params:
   *  func: function(pageUrl, details) is called with the url of the current
   *  page and the details of the network call
   */
  onCapture = (func) => {
    this._capture = func;
  }

}
