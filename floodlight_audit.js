/***********************************************************************
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Note that these code samples being shared are not official Google
products and are not formally supported.
************************************************************************/
var mode = "doubleclick";

var report = new ReportEntries();
var globalTag = new GlobalTagVerification();
var fl_call_tracker = new FloodlightTracker();

var graph = {
  found: 0,
  visited: 0
};

var currentUrl = "";
var max_depth = 10;
var current_depth = 0;
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
    fl_call_tracker.addToTracker(domain, mode, tab.url, event, floodlightConfigId)
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
  manual_enabled = $("#enable_manual").is(":checked");
  var url = getNextPage();
  // if tag reset enabled, add user paramaters to the next url in the graph
  url = enable_tag_reset ? constructUrl(url) : url;
  hasFloodlight = false;
  currentUrl = url;
  // set url for global tag object
  globalTag.setUrl(url);
  if(url) {
    chrome.tabs.executeScript(tab.id, {
      code: 'window.location = "' + url + '"'
    }, function(result) {
      if(depth <= max_depth) {
        chrome.tabs.executeScript(tab.id, {
          "file": "injector.js"
        }, function(result) {
          if(chrome.runtime.lastError) {
            console.warn('Error in loading url: ', url, chrome.runtime.lastError.message);
          }
          var links = result[0];
          var domain_regex = new RegExp('(https|http)?:\/\/(.+?\.+)?' + domain.replace('.', '\\.'));
          var domain_match = tab.url.match(domain_regex);
          // TODO: might need to fix this in the future, figure out how to handle case when tab is in domain that
          // does not match the original
          var base_url = domain_match ? domain_match[0] : '';

          for(var i = 0; i < links.length; i++) {
            var link = links[i].substring(1, links[i].length - 1);
            // filter out scraped links for only those that are expected
            var url_match = link.match(domain_regex);
            if(
              (url_match || link.startsWith('/')) &&
              !link.startsWith("mailto:") &&
              !link.startsWith("//") &&
              !link.startsWith('javascript:')
            ) {
              if(link.startsWith('/')) {
                link = base_url + link;
              }
              if(!graph[link]) {
                graph[link] = "FOUND";
                graph.found++;
                updateStats();
              }
            }
          }
        });
      }
      setTimeout(() => {
        // this makes sure we pass the updated tab to the next iteration of visit.
        chrome.tabs.get(tab.id, function(updatedTab) {
          current_depth += 1;
          previousPage = currentUrl;
          checkUntracked(previousPage);
          visit(updatedTab, depth + 1);
        })
      }, $('#loadTime').val() * 1000);
    });
  } else {
    checkUntracked(previousPage);
    stop();
  }
}

function constructUrl(url) {
  if(!url) return;
  var newUrl = url;
  var parameters = [];
  var gclid = $('#gclid').val();
  var gclsrc = $('#gclsrc').val();
  if(gclid !== '') parameters.push(`gclid=${gclid}`);
  if(gclsrc !== '') parameters.push(`gclsrc=${gclsrc}`);
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
  // updateReport();
  // updateStats();
  graph = {
    found: 0,
    visited: 0
  };
  current_depth = 0;
  $("#stop, #spinner, #next").hide();
  $("#run").show();
  globalTag.removeVerificationListener();
  chrome.tabs.onUpdated.removeListener(passiveModeListener);
  chrome.webRequest.onCompleted.removeListener(floodlightEventProxy);
  chrome.webRequest.onBeforeRedirect.removeListener(floodlightEventProxy);
}

// passiveModeListener - only fires in manual mode. Function sets the tool state
// to what is necssaery to read floodlight calls and also changes the window location
// based on the user's action.
function passiveModeListener(id, changeInfo, tab) {
  var url_regex = new RegExp(domain);
  // if url change is initiated and within the specified domain
  // clear global tag table if applicable, and update current url variables
  if(changeInfo.status === 'loading' && changeInfo.url) {
    if(changeInfo.url.match(url_regex)){
      previousPage = currentUrl;
      checkUntracked(previousPage);
      currentUrl = changeInfo.url;
      globalTag.setUrl(changeInfo.url);
    }
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

$(document).ready(function() {

  var tabId = Number($.urlParam("tabId"));
  var winId = Number($.urlParam("winId"));

  chrome.tabs.get(tabId, function(tab) {
    $("#domain").val(tab.url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1] || "");
  });

  $("#btn-doubleclick").click(function(e) {
    e.preventDefault();
    $("#li-doubleclick").addClass("active");
    $("#li-ga").removeClass("active");
    $("#user-params").show();
    $('#floodlight-dcm-report-table').show();
    $('#floodlight-ga-report-table').hide();
    mode = "doubleclick";
  });

  $("#btn-ga").click(function(e) {
    e.preventDefault();
    $("#li-ga").addClass("active");
    $("#li-doubleclick").removeClass("active");
    $("#user-params").hide();
    document.getElementById('gclid').value = '';
    document.getElementById('gclsrc').value = '';
    $('#floodlight-dcm-report-table').hide();
    $('#floodlight-ga-report-table').show();
    mode = "ga";
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
    var gstOutput = globalTag.printGlobalSiteTable();
    var date = new Date().toString().replace(/\s/g, "");
    download(`${domain}-${mode}-floodlight-report-${date}.csv`, floodlightOutput);
    download(`${domain}-gst-report-${date}.csv`, gstOutput);
  });

  $("#stop").click(() => {
    stop();
  });

  $("#run").click(function() {
    // pull values from form elements
    gclid = $('#gclid').val();
    profileId = $("#profileId").val();
    accountId = $("#accountId").val();
    var fl_config_value = $("#floodlightConfigId").val();
    // if there are values in the Floodlight config, remove spaces and split it into a list
    floodlightConfigId = fl_config_value != "" ?
        fl_config_value.replace(/\s/g, '').split(",") :
        [];
    domain = $("#domain").val();
    max_depth = parseInt($("#depth").val());
    manual_enabled = document.getElementById("enable_manual").checked; //////TEST
    show_no_floodlight = document.getElementById("show_no_floodlight").checked;
    global_tag_verification_enabled = document.getElementById("enable_tag_verification").checked;
    enable_tag_reset = document.getElementById("enable_tag_reset").checked;

    // hide/show UI elements for run state
    $("#run").hide();
    $("#stop").show();
    $("#spinner").show();
    $('#floodlight-dcm-report-body, #floodlight-ga-report-body').html("");

    localStorage.setItem("report", "");
    report = new ReportEntries();
    // clear global tag table values and event listeners
    globalTag.globalVerificationReset();
    chrome.tabs.onUpdated.removeListener(passiveModeListener);

    // reset floodlight tracker object and counter
    fl_call_tracker.clearTracker();
    fl_call_tracker.setGclid(gclid);
    fl_call_tracker.setShowNoFloodlight(show_no_floodlight);
    fl_call_tracker.setDcmInformation(profileId, accountId);


    if (mode == 'doubleclick' && profileId != '' && accountId != ''){
      dcMode = 'authentication';
    }

    chrome.tabs.get(tabId, function(tab) {
      currentUrl = tab.url;
      // clear first party cookies before initial run
      globalTag.clearFirstPartyCookies(currentUrl, domain);
      var urls = [];
      if(mode == 'doubleclick') {
        urls = [
            "https://ad.doubleclick.net/activity*",
            "http://ad.doubleclick.net/activity*",
            "https://ad.doubleclick.net/ddm/activity*",
            "http://ad.doubleclick.net/ddm/activity*",
            "https://*.fls.doubleclick.net/activityi*",
            "http://*.fls.doubleclick.net/activityi*"
          ];
      } else if (mode == 'ga') {
        urls = [
          "https://www.google-analytics.com/collect*",
          "http://www.google-analytics.com/collect*",
          "https://www.google-analytics.com/r/collect*",
          "http://www.google-analytics.com/r/collect*"
        ];
      }

      ////////////////////// NEW FLOODLIGHT TRACKER START //////////////////////
      // setup floodlight tracking on completed(200) network calls
      chrome.webRequest.onCompleted.addListener(
        floodlightEventProxy, {
        "urls": [
          ...urls,
          "http://adservice.google.com/*",
          "https://adservice.google.com/*",
          "http://adservice.google.com/ddm/*",
          "https://adservice.google.com/ddm/*"
        ]
      });

      // setup floodlight tracking on redirect(302) network calls
      chrome.webRequest.onBeforeRedirect.addListener(
        floodlightEventProxy, {
        "urls": [
          "https://*.fls.doubleclick.net/activityi*",
          "http://*.fls.doubleclick.net/activityi*",
          "http://stats.g.doubleclick.net/r/collect/*",
          "https://stats.g.doubleclick.net/r/collect/*"
        ]
      });
      ////////////////////// NEW FLOODLIGHT TRACKER END //////////////////////

      // adds any user defined parameters (gclid || gclsrc) to base url before start
      var baseUrl = constructUrl(tab.url);

      // enable global tag verification if specified by the user
      if(global_tag_verification_enabled) {
        globalTag.setUrl(baseUrl);
        globalTag.setTabId(tabId);
        globalTag.globalVerificationSetup();
      }

      // if manual mode is enabled, run initial step for tool's manual mode
      if(manual_enabled){
        chrome.tabs.onUpdated.addListener(passiveModeListener);
        currentUrl = baseUrl;
        chrome.tabs.executeScript(tabId, {
          code: 'window.location = "' + baseUrl + '"'
        });
      } else {
        // else run initial step for tool's automatic mode
        graph[baseUrl] = "FOUND";
        console.log('ON RUN graph state:', graph);

        visit(tab, 0);
      }
    });
  });
});
