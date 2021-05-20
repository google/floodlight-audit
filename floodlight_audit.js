/***************************************************************************
*
*  Copyright 2020 Google Inc.
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
var mode = "doubleclick";

var report = new ReportEntries();
var globalTag = new GlobalTagVerification();
var fl_call_tracker = new FloodlightTracker();
//var other_tag_tracker = new OtherTracker();
var TAB_ID;
var WIN_ID;

var graph = null

function resetGraph() {
  graph = {
    found: 0,
    visited: 0,
  };
};
resetGraph();

var currentUrl = "";
var max_depth = 10;
var current_depth = 0;
var loadTime = 6;
var domain = "";
var show_no_floodlight = false;
var previousPage = null;
var hasFloodlight = false;
var dcm = null;
var gclid = "";
var profileId = "";
var accountId = "";
var dcMode = "";
var global_tag_verification_enabled = false;
var enable_tag_reset = false;
var manual_enabled = false;
var floodlight_counter = 0;
var floodlightConfigId = [];
var behaviorInterval = null;

// Determines if the page should be scraped for links, if false it will only
// visit links already on the graph. For instance, if the user uploads a file
// with URLs and only those should be visited this is flipped to false
var discovery = true;

$.urlParam = function(name){
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
  return results[1] || 0;
};

function updateStats() {
  $("#pages-found").text(graph.found);
  $("#pages-visited").text(graph.visited);
  $("#floodlight-tags").text(fl_call_tracker.counter);
}

function floodlightEventProxy(event) {
  // tacks on current url as a parameter for
  // floodlight tracking function
  chrome.tabs.get(event.tabId, (tab) => {
    fl_call_tracker.addToTracker(discovery ? domain : '', mode, tab.url, event, floodlightConfigId)
  });
}

function getNextPage() {
  for (var url in graph) {
    if (graph.hasOwnProperty(url)) {
      if (graph[url] == "FOUND") {
        graph[url] = "VISITED";
        graph.visited++;
        updateStats();
        return url;
      }
    }
  }
  return;
}

function urlExists(url) {
  var http = new XMLHttpRequest();
  http.addEventListener("error", (err) => {console.warn(`Error requesting page, url will be set to BROKEN: ${err} ${url}`)});
  http.open('HEAD', url, false);
  http.send();
  return http.status >= 200 && http.status <= 302;
}

function checkUntracked(page) {
  if(
    page &&
    !fl_call_tracker.tracker[page] &&
    show_no_floodlight
  ) {
    fl_call_tracker.addEmptyTrackerEntry(mode, page);
  }
}

function visit(tab, depth) {
  var nextUrl = getNextPage();
  if(graph.found === 1) { // if tag reset enabled, add user paramaters to the next url in the graph
    nextUrl = constructUrl(nextUrl, true);
  } else { //always add gclid and gclsrc to first visit
    nextUrl = constructUrl(nextUrl, enable_tag_reset);
  }
  console.log('Visit: ', nextUrl);
  hasFloodlight = false;
  currentUrl = nextUrl;
  if(nextUrl) {
    // set url for global tag object
    globalTag.setUrl(nextUrl);
    chrome.tabs.update(tab.id, {
      url: nextUrl
    }, function() {
      // NOTE: Scraping logic moved out of this because it required hacky workaround
      // to function as expected. Scraping logic now lives in function scrapeLinks and
      // runs on page load complete (function:: tabOnCompleteListener)
      setTimeout(() => {
        if(chrome.runtime.lastError) {
          console.warn('Error in loading url: ', url, chrome.runtime.lastError.message);
          setTimeout(() => {
            console.warn('Error on current page, visiting next page...')
            driveVisit(tab, nextUrl, depth)
          }, loadTime * 1000);
        }
        // code snippet to drive next visit after specified time limit
        // else {
        //   setTimeout(() => {
        //     driveVisit(tab, currentUrl)
        //   }, loadTime * 1000);
        // }
      }, loadTime * 1000);
    });
  } else {
    checkUntracked(previousPage);
    stop();
  }
}

// function runs scraping script on target tab
function scrapeLinks(targetTab) {
  if(discovery) {
    chrome.tabs.executeScript(targetTab.id, {
      "file": "injector.js"
    }, function(result) {
      if(result) {
        if(result.length > 0) {
          var links = result[0];
          var updatedURL = targetTab.url;
          var currentDomainMatch = updatedURL.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im);
          var current_domain = currentDomainMatch[1];

          // makes sure to get the current domain in which the scrpaed links are found
          // so that it may correctly appended to relative links (eg. mycurrent.domain.com/#nav)
          var current_base_url = currentDomainMatch ? currentDomainMatch[0] : '';

          // var domain_regex = new RegExp('^(https|http)?:\/\/(.+?\.+)?' + domain.replace('.', '\\.')); // ORIGINAL
          var domain_regex = new RegExp('^(https|http)?:\/\/(.+?\.+)?' + domain.replace('.', '\\.'));
          // var domain_match = url.match(domain_regex);

          // TODO: might need to fix this in the future, figure out how to handle case when tab is in domain that
          // does not match the original
          // var base_url = domain_match ? domain_match[0] : '';

          for(var i = 0; i < links.length; i++) {
            var link = links[i].substring(1, links[i].length - 1);
            // filter out scraped links for only those that are expected and within the original domain
            var url_match = link.match(domain_regex); //original
            if(
              (url_match || link.startsWith('/')) &&
              !link.startsWith("mailto:") &&
              !link.startsWith("//") &&
              !link.startsWith('javascript:')
            ) {
              if(current_domain === domain && link.startsWith('/')) {
                link = current_base_url + link;
              } else if (current_domain != domain && link.startsWith('/')) {
                link = null;
              }
              if(link && !graph[link]) {
                graph[link] =  "FOUND";
                graph.found++;
                // if(urlExists(link)) {}
                updateStats();
              }
            }
          }
        }
      }
    });
  }
}

function driveVisit(updatedTab, currentUrl, depth) {
    current_depth += 1;
    previousPage = currentUrl;
    checkUntracked(previousPage);
    visit(updatedTab, depth + 1);
}

function constructUrl(url, includeUserParams) {
  if(!url) return;
  var newUrl = url;
  var parameters = [];
  if (includeUserParams) {
    var gclid = $('#gclid').val();
    var gclsrc = $('#gclsrc').val();
    if(gclid !== '') parameters.push(`gclid=${gclid}`);
    if(gclsrc !== '') parameters.push(`gclsrc=${gclsrc}`);
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

function triggerNext() {
  $("#spinner").show();
  var tabId = Number($.urlParam("tabId"));
  chrome.tabs.get(tabId, function(tab) {
    visit(tab, current_depth);
  });
}

function stop() {
  if (graph.found > 0) {
    console.log('Audit has ended.');
    console.log('Resulting data: ', graph, fl_call_tracker.tracker);
  }
  resetGraph();
  current_depth = 0;
  $("#stop, #spinner, #next").hide();
  $("#run").show();
  globalTag.removeVerificationListener();
  chrome.webRequest.onBeforeSendHeaders.removeListener(disableRequestCache)
  chrome.tabs.onUpdated.removeListener(passiveModeListener);
  chrome.tabs.onUpdated.removeListener(tabOnCompleteListener);
  chrome.webRequest.onCompleted.removeListener(floodlightEventProxy);
  chrome.webRequest.onBeforeRedirect.removeListener(floodlightEventProxy);
 //chrome.webRequest.onCompleted.removeListener(otherEventProxy);
 //  chrome.webRequest.onBeforeRedirect.removeListener(otherEventProxy);
}

// passiveModeListener - only fires in manual mode. Function sets the tool state
// to what is necssaery to read floodlight calls and also changes the window location
// based on the user's action.
function passiveModeListener(id, changeInfo, tab) {
  var url_regex = new RegExp(domain);
  // if url change is initiated and within the specified domain
  // clear global tag table if applicable, and update current url variables
  if(changeInfo.status === 'complete' && changeInfo.url) {
    var page_url = decodeURI(changeInfo.url);
    if(page_url.match(url_regex)){
      checkUntracked(previousPage);
      previousPage = currentUrl;
      currentUrl = page_url;
      // globalTag.setUrl(changeInfo.url);
    }
  }
}


// listener function to vefify that the tab has loaded completely and initiate visit 
// to next page.
function tabOnCompleteListener(id, changeInfo, tab) {
  if (id === TAB_ID && changeInfo.status === 'complete') {
    scrapeLinks(tab);
    setTimeout(() => {
      driveVisit(tab, currentUrl, current_depth);
    }, loadTime * 1000)
  }
}


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

// **************************************************************************
// NOTE: below code sets up file input to listen for upload
// and parse through expected CSV file for URLS. Need to add logic
// for converting urls wildcards into RegExps 
function setupFileUploader() {
  var fileChooser = $('#fileInput');
  fileChooser.on('change', readFileContents);
}

function removeFileUploadListener() {
  var fileChooser = $('#fileInput');
  fileChooser.off('change', readFileContents);
}

function readFileContents(event) {
  discovery = true;
  resetGraph();
  var fileChooser = $('#fileInput');

  if(fileChooser[0].files.length) {
    console.log('Event: ', event)
    var reader = new FileReader();
    reader.onload = function (e) {
      var split_data = e.target.result.split("\n");
      var data = [];
      split_data.forEach(row => {
        data.push(row.split(','));
      });
      if(data.length > 0) {
        buildGraphFromFile(data);
        discovery = false;
      }
    }
    reader.readAsText(fileChooser[0].files[0]);
  }
}

function buildGraphFromFile(urls) {
  for(var i = 0; i < urls.length; i++) {
    if(urls.length > 0) {
      var url = urls[i][0];
      if(!graph[url]) {
        graph[url] = "FOUND";
        graph.found++;
      }
    }
  }
}
// **************************************************************************

function updateBehavior() {
  chrome.webRequest.handlerBehaviorChanged(() => {
    console.log('Web request handler behavior has been changed, clearing cache.');
  });
}

function disableRequestCache(details) {
  var headers = details.requestHeaders || [];
  headers.push({
      "name": "Cache-Control",
      "value": "no-cache"
  });
  return {requestHeaders: headers};
}

$(document).ready(function() {
  var gclidElement = document.getElementById("gclid");
  var gclidVal = document.createTextNode("Test-" + Math.floor((Math.random() * 1000) + 1));
  gclidElement.appendChild(gclidVal);

  removeFileUploadListener();
  setupFileUploader();

  TAB_ID = Number($.urlParam("tabId"));
  WIN_ID = Number($.urlParam("winId"));

  chrome.tabs.get(TAB_ID, function(tab) {
    $("#domain").val(tab.url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1] || "");
  });

  $("#enable_tag_verification").change(function() {
    var value = $(this).is(":checked");
    if(value) {
      $('#global-site-panel').show();
    } else {
      $('#global-site-panel').hide();
    }
  });

  $("#enable_manual").change(function() {
    var value = $(this).is(":checked");
    if(value) {
      $('#stats-panel, #enable_tag_parent').hide();
      $('#enable_tag_reset').prop("checked", false);
    } else {
      $('#stats-panel, #enable_tag_parent').show();
    }
  });

  $("#download").click(function() {
    var floodlightOutput = fl_call_tracker.printTracker(mode);
    //var otherTagOutput = other_tag_tracker.printTracker();
    var gstOutput = globalTag.printGlobalSiteTable();
    var date = new Date().toString().replace(/\s/g, "");
    download(`${domain}-${mode}-floodlight-report-${date}.csv`, floodlightOutput);
    //download(`${domain}-other-tag-report-${date}.csv`, otherTagOutput);
    if(global_tag_verification_enabled) {
      download(`${domain}-gst-report-${date}.csv`, gstOutput);
    }
  });

  $("#stop").click(() => {
    //update behavior every 3 mins
    window.clearTimeout(behaviorInterval)
    behaviorInterval = null;
    stop();
  });

  $("#run").click(function() {
    // pull values from form elements
    gclid = document.getElementById('gclid').innerText
    profileId = $("#profileId").val();
    accountId = $("#accountId").val();
    var fl_config_value = $("#floodlightConfigId").val();
    // if there are values in the Floodlight config, remove spaces and split it into a list
    floodlightConfigId = fl_config_value != "" ?
        fl_config_value.replace(/\s/g, '').split(",") :
        [];
    domain = $("#domain").val();
    max_depth = parseInt($("#depth").val());
    loadTime = parseInt($("#loadTime").val());
    manual_enabled = document.getElementById("enable_manual").checked; //////TEST
    show_no_floodlight = document.getElementById("show_no_floodlight").checked;
    global_tag_verification_enabled = document.getElementById("enable_tag_verification").checked;
    enable_tag_reset = document.getElementById("enable_tag_reset").checked;

    updateStats();
    // hide/show UI elements for run state
    $("#run").hide();
    $("#stop").show();
    $("#spinner").show();
    $('#floodlight-dcm-report-body').html("");
    //$('#other-tag-body').html("");

    localStorage.setItem("report", "");
    report = new ReportEntries();
    // clear global tag table values and event listeners
    globalTag.globalVerificationReset();
    chrome.tabs.onUpdated.removeListener(passiveModeListener);
    chrome.tabs.onUpdated.removeListener(tabOnCompleteListener);

    // reset floodlight tracker object and counter
    fl_call_tracker.clearTracker();
    fl_call_tracker.setGclid(gclid);
    fl_call_tracker.setShowNoFloodlight(show_no_floodlight);
    fl_call_tracker.setDcmInformation(profileId, accountId);

    //other_tag_tracker.clearTracker();
    // other_tag_tracker.setGclid(gclid);

    if (mode == 'doubleclick' && profileId != '' && accountId != ''){
      dcMode = 'authentication';
    }

    chrome.tabs.get(TAB_ID, function(tab) {
      currentUrl = tab.url;
      // clear first party cookies before initial run
      globalTag.clearFirstPartyCookies(currentUrl, domain);
      var urls = [];
      //var otherurls = [];
      if(mode == 'doubleclick') {
        urls = [
            "https://ad.doubleclick.net/activity*",
            "http://ad.doubleclick.net/activity*",
            "https://ad.doubleclick.net/ddm/activity*",
            "http://ad.doubleclick.net/ddm/activity*",
            "https://*.fls.doubleclick.net/activityi*",
            "http://*.fls.doubleclick.net/activityi*",
            "https://*.fls.doubleclick.net/activityj*",
            "http://*.fls.doubleclick.net/activityj*",
            "https://fls.doubleclick.net/activityi*",
            "http://fls.doubleclick.net/activityi*",
            "https://fls.doubleclick.net/activityj*",
            "http://fls.doubleclick.net/activityj*",
            "http://*.google-analytics.com/i/collect*",
            "http://*.google-analytics.com/j/collect*",
            "http://*.google-analytics.com/collect*",
            "http://*.google-analytics.com/g/collect*",
            "https://*.google-analytics.com/i/collect*",
            "https://*.google-analytics.com/j/collect*",
            "https://*.google-analytics.com/collect*",
            "https://*.google-analytics.com/g/collect*",
            "http://*.g.doubleclick.net/pagead/viewthroughconversion/*",
            "https://*.g.doubleclick.net/pagead/viewthroughconversion/*",
            "http://*.googleadservices.com/pagead/conversion/*",
            "https://*.googleadservices.com/pagead/conversion/*"
          ];
      }

      ////////////////////// NEW FLOODLIGHT TRACKER START //////////////////////
      chrome.webRequest.onBeforeSendHeaders.addListener(
        disableRequestCache,
        { "urls": [
          ...urls,
          //"http://adservice.google.com/*",
          //"https://adservice.google.com/*",
          //"http://adservice.google.com/ddm/*",
          //"https://adservice.google.com/ddm/*",
          "https://*.fls.doubleclick.net/activityi*",
          "http://*.fls.doubleclick.net/activityi*",
          "https://*.fls.doubleclick.net/activityj*",
          "http://*.fls.doubleclick.net/activityj*",
          "https://fls.doubleclick.net/activityi*",
          "http://fls.doubleclick.net/activityi*",
          "https://fls.doubleclick.net/activityj*",
          "http://fls.doubleclick.net/activityj*",
          "http://stats.g.doubleclick.net/r/collect/*",
          "https://stats.g.doubleclick.net/r/collect/*",
          "http://*.google-analytics.com/*",
          "https://*.google-analytics.com/*",
          "http://*.g.doubleclick.net/pagead/viewthroughconversion/*",
          "https://*.g.doubleclick.net/pagead/viewthroughconversion/*",
          "http://*.googleadservices.com/pagead/conversion/*",
          "https://*.googleadservices.com/pagead/conversion/*"
        ]
      });
      // setup floodlight tracking on completed(200) network calls
      chrome.webRequest.onCompleted.addListener(
        floodlightEventProxy, {
        "urls": [
          ...urls
          //,"http://adservice.google.com/*",
          //"https://adservice.google.com/*",
          //"http://adservice.google.com/ddm/*",
          //"https://adservice.google.com/ddm/*"
        ]
      });

      // setup floodlight tracking on redirect(302) network calls
      chrome.webRequest.onBeforeRedirect.addListener(
        floodlightEventProxy, {
        "urls": [
          "https://*.fls.doubleclick.net/activityi*",
          "http://*.fls.doubleclick.net/activityi*",
          "https://*.fls.doubleclick.net/activityj*",
          "http://*.fls.doubleclick.net/activityj*",
          "https://fls.doubleclick.net/activityi*",
          "http://fls.doubleclick.net/activityi*",
          "https://fls.doubleclick.net/activityj*",
          "http://fls.doubleclick.net/activityj*",
          "http://stats.g.doubleclick.net/r/collect/*",
          "https://stats.g.doubleclick.net/r/collect/*",
          "http://*.google-analytics.com/i/collect*",
          "http://*.google-analytics.com/j/collect*",
          "http://*.google-analytics.com/collect*",
          "http://*.google-analytics.com/g/collect*",
          "https://*.google-analytics.com/i/collect*",
          "https://*.google-analytics.com/j/collect*",
          "https://*.google-analytics.com/collect*",
          "https://*.google-analytics.com/g/collect*",
          "http://*.g.doubleclick.net/pagead/viewthroughconversion/*",
          "https://*.g.doubleclick.net/pagead/viewthroughconversion/*",
          "http://*.googleadservices.com/pagead/conversion/*",
          "https://*.googleadservices.com/pagead/conversion/*"
        ]
      });
      ////////////////////// NEW FLOODLIGHT TRACKER END //////////////////////

      // adds any user defined parameters (gclid || gclsrc) to base url before start
      var baseUrl = manual_enabled ? constructUrl(tab.url, enable_tag_reset) : tab.url;
      // enable global tag verification if specified by the user
      if(global_tag_verification_enabled) {
        globalTag.globalVerificationSetup(baseUrl, TAB_ID, gclid);
      }

      updateBehavior();
      //update behavior every 3 mins
      behaviorInterval = window.setTimeout(updateBehavior, 180000);

      // if manual mode is enabled, run initial step for tool's manual mode
      if(manual_enabled){
        chrome.tabs.onUpdated.addListener(passiveModeListener);
        currentUrl = baseUrl;
        chrome.tabs.update(TAB_ID, {
          url: baseUrl
        });
      } else {
        // else run initial step for tool's automatic mode
        graph[baseUrl] = "FOUND";
        graph.found += 1;
        console.log('ON RUN graph state:', graph);
        // adds listener to wait for page to load completely before moving to the next page
        chrome.tabs.onUpdated.addListener(tabOnCompleteListener);
        visit(tab, current_depth);
      }
    });
  });
});
