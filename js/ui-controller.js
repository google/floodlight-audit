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
 * UI controller, handles events and communication between the UI and
 * functionality
 */
class UIController {

  constructor() {
    // Flag that controls if global site tag verification is enabled
    this.enableTagVerification = false;
    // Global Tag verification tracker
    this.globalTag = null;
    // Flag that controls whether to run on manual mode or automatic crawling
    // mode
    this.manualMode = false;
    // Controls whether to discover new pages or only scan list of urls uploaded
    this.discovery = true;
    // Holds instance of web crawler
    this.crawler = null;
    // Holds instance of the network monitor
    this.monitor = null;
    // Flag indicating whether to show pages with no tags
    this.showNoFloodlight = false;
    // Tracker for report generation
    this.floodlightTracker = null;
    // List of urls uploaded by the user
    this.urls = null;

    this.domain = null;

    this.TAB_ID = null;

    this.init();
  }

  /**
   * Event handler for URL upload functionality, reads the file contents and
   * builds url map from data
   */
  readFileContents = (event) => {
    this.discovery = true;
    var that = this;
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
          that.urls = data;
          console.log(`setting discovery to false, see what difference it makes`);
          that.discovery = false;
        }
      }
      reader.readAsText(fileChooser[0].files[0]);
    }
  }

  /**
   * Sets up the file upload listener to receive URL list uploads
   */
  setupFileUploader = () => {
    var fileChooser = $('#fileInput');
    fileChooser.on('change', this.readFileContents);
  }

  /**
   * Stop button click
   */
  stopClick = () => {
    if(this.crawler) {
      this.crawler.stop();
    }

    this.monitor.stop();

    this.globalTag.removeVerificationListener();

    $("#stop, #spinner, #next").hide();
    $("#run").show();
  }

  /**
   * Generates the gclid parameters for global site tag verification
   */
  generateGclid = () => {
    // generate test gclid value
    var gclidElement = document.getElementById("gclid");
    var gclidNode = document.createTextNode("Test-" + Math.floor((Math.random() * 1000) + 1));
    gclidElement.appendChild(gclidNode);
    // generate test gclsrc value
    var gclsrcElement = document.getElementById("gclsrc");
    var gclsrcNode = document.createTextNode("aw.ds");
    gclsrcElement.appendChild(gclsrcNode);
  }

  /**
   * Run button click
   */
  runClick = () => {
    chrome.tabs.get(this.TAB_ID, (tab) => {
      this.domain = $("#domain").val();
      var enable_tag_reset = document.getElementById("enable_tag_reset").checked;

      var loadTime = parseInt($("#loadTime").val());
      var startingUrl = constructUrl(scrubUrl(tab.url), true);

      // Setup global tag verification
      this.globalTag = new GlobalTagVerification();
      this.globalTag.globalVerificationReset();

      if(this.enableTagVerification) {
        var gclid = document.getElementById('gclid').innerText
        this.globalTag.globalVerificationSetup(startingUrl, this.TAB_ID, gclid);
        updateBehavior();
      }

      // Setup network monitor
      this.monitor = new NetworkMonitor(tab, monitoringUrls);

      this.monitor.onCapture((url, event) => {
        console.log(`adding url to tracker: ${url}`);
        this.floodlightTracker.addToTracker(this.discovery ? this.domain : '', 'doubleclick',
            url, event, []);
      });

      // Setup floodlight tracker
      this.showNoFloodlight = document.getElementById("show_no_floodlight").checked;
      this.floodlightTracker = new FloodlightTracker(null, null, null, this.showNoFloodlight);

      // Setup crawler
      this.crawler = new WebCrawler(startingUrl, tab, loadTime, this.domain,
          this.discovery);

      if(this.urls) {
        this.crawler.setUrls(this.urls);
      }

      this.crawler.onBeforeVisit((url) => {
        url = constructUrl(url, enable_tag_reset);
        this.globalTag.setUrl(url);

        return url;
      });

      var previousUrl = null;

      this.crawler.onUpdateStats((found, visited, url, done) => {
        $("#pages-found").text(found);
        $("#pages-visited").text(visited);
        $("#floodlight-tags").text(this.floodlightTracker.counter);

        if(previousUrl) {
          if(!this.floodlightTracker.tracker[previousUrl] && this.showNoFloodlight) {
            this.floodlightTracker.addEmptyTrackerEntry('doubleclick', previousUrl);
          }
        }

        previousUrl = url;

        if(done) {
          console.log('done');
          this.stopClick();
        }
      });

      this.monitor.start();
      this.crawler.start(this.manualMode);

      $("#run").hide();
      $("#stop, #spinner").show();
      $('#floodlight-dcm-report-body').html("");
    });
  }

  /**
   * Download button click. Downloads the current report to the user
   */
  downloadClick = () => {
    if(this.floodlightTracker) {
      var gstOutput = this.globalTag.printGlobalSiteTable();
      var out = this.floodlightTracker.printTracker('doubleclick');
      var date = new Date().toString().replace(/\s/g, "");

      download(`${this.domain}-doubleclick-floodlight-report-${date}.csv`, out);

      if(this.enableTagVerification) {
        download(`${this.domain}-gst-report-${date}.csv`, gstOutput);
      }
    }

    // TODO download other types of outputs
  }

  /**
   * On change hander for enable tag verification checkbox
   */
  enableTagVerificationChange = () => {
    this.enableTagVerification = $("#enable_tag_verification").is(":checked");
    if(this.enableTagVerification) {
      $('#global-site-panel').show();
    } else {
      $('#global-site-panel').hide();
    }
  }

  /**
   * On change handler for enable manual checkbox
   */
  enableManualChange = () => {
    this.manualMode = $("#enable_manual").is(":checked");
    if(this.manualMode) {
      $('#stats-panel, #enable_tag_parent').hide();
      $('#enable_tag_reset').prop("checked", false);
    } else {
      $('#stats-panel, #enable_tag_parent').show();
    }
  }

  /**
   * Initializes ui controller setting up required values and hooks up event
   * handlers
   */
  init = () => {
    this.TAB_ID = Number($.urlParam("tabId"));
    this.WIN_ID = Number($.urlParam("winId"));

    this.generateGclid();
    this.setupFileUploader();

    chrome.tabs.get(this.TAB_ID, (tab) => {
      $("#domain").val(tab.url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1] || "");
    });

    // TODO behavior change every 3 minutes

    $("#stop").click(this.stopClick);
    $("#run").click(this.runClick);
    $("#download").click(this.downloadClick);
    $("#enable_tag_verification").change(this.enableTagVerificationChange);
    $("#enable_manual").change(this.enableManualChange);
  }
}
var uiController = null;

/**
 * On ready, initializes ui controller
 */
$(document).ready(function() {
  uiController = new UIController();
});

