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
 * Crawls a web site
 *
 * params:
 *  startingUrl: starting point for crawling
 *  tab: chrome tab in which to load pages
 *  loadTime: number, seconds to wait for pages to load
 *  domain: restricts crawling to this domain
 *  discovery: true if links should be scraped from the page, false otherwise
 */
class WebCrawler {
  constructor(startingUrl, tab, loadTime, domain, discovery) {
    // The target tab ID
    this.TAB_ID = tab.id;
    // Reference to the chrome tab
    this.tab = tab
    // Whether the crawler is running
    this.running = false;
    // Current depth of the crawling
    this.depth = 1;
    // Handler to emit status updates
    this._updateStats = null;
    // Handler to emit before visit events
    this._beforeVisit = null;
    // Handler to check if a page should be visited
    this._shouldVisit = null;
    // Maintains a map of found and visited urls
    this.urlMap = null;
    // Starting point of the crawler
    this.startingUrl = startingUrl;
    // Domain that is being crawled
    this.domain = domain;
    // Discover new links on the page
    this.discovery = discovery;
    // How long to wait for the page to load
    this.loadTime = loadTime;

    // Initialization
    chrome.tabs.onUpdated.addListener(this.tabOnCompleteListener);
  }

  /**
   * Sets a list of urls to be visited by the crawler
   *
   * params:
   *  urls: list of strings representing the urls to visit
   */
  setUrls = (urls) => {
    this.resetUrlMap();

    urls.forEach(url => this.found(url));
  }

  // Resets the url map
  resetUrlMap = () => {
    this.urlMap = {
      found: 0,
      visited: 0
    }
  }

  /**
   * Triggers the update stats event
   *
   * params:
   *  url: the current url
   */
  updateStats = (url) => {
    if(this._updateStats) {
      this._updateStats(this.urlMap.found, this.urlMap.visited, url, !this.running);
    }
  }

  /**
   * Adds a new URL to the map
   *
   * params:
   *  url: String url to add
   */
  found = (url) => {
    if(!this._shouldVisit || this._shouldVisit(url)) {
      if(!this.urlMap[url]) {
        this.urlMap[url] = "FOUND";
        this.urlMap.found++;
      }
    }
  }

  /**
   * Gets the next page to visit, updates urlMap to signal previous page has
   * been visited
   *
   * returns url of the next page to visit, or null if none are found
   */
  getNextPage = () => {
    for (var url in this.urlMap) {
      if (this.urlMap.hasOwnProperty(url)) {
        if (this.urlMap[url] == "FOUND") {
          this.urlMap[url] = "VISITED";
          this.urlMap.visited++;
          return url;
        }
      }
    }
    return;
  }

  /**
   * Event handler for when tabs are fully loaded, it scrape the page for links
   * to visit
   *
   * params: @see tabOnCompleteListener in chrome extensions documentation
   */
  tabOnCompleteListener = (id, changeInfo, tab) => {
    if(this.running && changeInfo.status === 'complete' && id === this.TAB_ID) {
      this.updateStats(this.previousUrl);
      this.previousUrl = scrubUrl(tab.url);

      if (!this.passive && this.discovery) {
        this.scrapeLinks(tab);
      }

      if(!this.passive) {
        wait(this.loadTime * 1000).then(this.visit);
      }
    }
  }

  /**
   * Scrapes a web page and find links for further crawling
   */
  scrapeLinks = () => {
    chrome.tabs.executeScript(this.TAB_ID, {
      "file": "js/injector.js"
    }, (result) => {
      if(result) {
        if(result.length > 0) {
          var links = result[0];
          var updatedURL = this.tab.url;
          var currentDomainMatch = updatedURL.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im);
          var current_domain = currentDomainMatch[1];

          // makes sure to get the current domain in which the scrpaed links are found
          // so that it may correctly appended to relative links (eg. mycurrent.domain.com/#nav)
          var current_base_url = currentDomainMatch ? currentDomainMatch[0] : '';

          var domain_regex = new RegExp('^(https|http)?:\/\/(.+?\.+)?' + this.domain.replace('.', '\\.'));

          for(var i = 0; i < links.length; i++) {
            var link = links[i].substring(1, links[i].length - 1);

            // filter out scraped links for only those that are expected and within the original domain
            var url_match = link.match(domain_regex); //original
            if(
              (url_match || link.startsWith('/')) &&
              !link.startsWith("mailto:") &&
              !link.startsWith("//") &&
              !link.startsWith('javascript:') &&
              !link.startsWith('chrome-extension:')
            ) {
              if(current_domain === domain && link.startsWith('/')) {
                link = current_base_url + link;
              } else if (current_domain != domain && link.startsWith('/')) {
                link = null;
              }

              // add clean URL to grpah to reduce duplication
              var cleanLink = scrubUrl(link);

              if(cleanLink && cleanLink != 'null' && cleanLink != 'undefined') {
                this.found(cleanLink);
              }
            }
          }
        }
      }
    });
  }

  /**
   * Visits a webpage
   */
  visit = () => {
    var nextUrl = this.getNextPage();

    if(this.running && nextUrl) {

      if(this.beforeVisit) {
        nextUrl = this.beforeVisit(nextUrl);
      }
      return new Promise((resolve, reject) => {
        console.log('Visit: ', nextUrl);
        var hasFloodlight = false;

        if(nextUrl) {
          chrome.tabs.update(this.TAB_ID, {
            url: nextUrl
          }, () => {
            wait(this.loadTime * 1000).then(() => {
              if(chrome.runtime.lastError) {
                reject('Error in loading url: ', url, chrome.runtime.lastError.message);
              } else {
                resolve(true);
              }
            });
          });
        } else {
          this.stop();
          resolve(false);
        }
      });
    } else {
      this.running = false;
    }
  }

  /**
   * Set up a handler to check whether a page should be visited.
   *
   * params: func function that takes a string url and returns true / false
   * indicating it should be visited
   */
  shouldVisit = (func) => {
    this._shouldVisit = func;
  }

  /**
   * Set up a listener to emit updates whenever there is a status change
   *
   * params: func function(found, visited, url, done)
   */
  onUpdateStats = (func) => {
    this._updateStats = func;
  }

  /**
   * Event triggered before a page is visited
   *
   * params:
   *  function(url): callback function, receives the url that will be visited
   *  next
   */
  onBeforeVisit = (func) => {
    this._beforeVisit = func;
  }

  /**
   * Triggers the before visit event
   *
   * params:
   *  url: the url that will be visited
   */
  beforeVisit = (url) => {
    if(this._beforeVisit) {
      return this._beforeVisit(url);
    }

    return url;
  }

  /**
   * Stops the crawler
   */
  stop = () => {
    this.running = false;
  }

  /**
   * Starts the crawler
   *
   * params:
   *  passive: boolean, if true the crawler only listens for events and do not
   *  actively crawl the website, this allows users to navigate themselves in
   *  manual mode
   */
  start = (passive) => {
    if(this.discovery) {
      this.resetUrlMap();
      this.found(this.startingUrl);
    }

    this.previousUrl = this.startingUrl;
    this.running = true;
    this.passive = passive;

    if(!this.passive) {
      this.visit();
    }
  }

}
