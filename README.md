# Conversion Audit Tool

The Conversion Tag Audit Tool is a chrome extension that crawls a website and
generates a gTag (and Google Analytics, Google Ads and Floodlight event tags)
report by monitoring network traffic from the page.

In this document, we will be outlining the installation, base functionality,
features and way to use the Conversion Tag Audit Tool that may come up in most
use cases.

The Conversion Tag Audit Tool is not an officially supported Google product.

## License

Copyright 2021 Google LLC

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.

Note that these code samples being shared are not official Google products and
are not formally supported.

## Installation

1.  Download/pull the source code to a local directory of your choosing.
2.  Rename the manifest.json.template file at the root directory of the code to
    manifest.json.
3.  Open a chrome browser window, navigate the extensions management page by
    browsing to: chrome://extensions/
4.  On the top right of the page flip the "Developer Mode" switch to on.
5.  At the top of the page, on the left, click the “Load Unpacked Extension ...”
    button
6.  Select the “floodlight-audit” folder created when you downloaded the source
    code.
7.  The tool should now be installed, and a new icon should show in the
    extensions toolbar on the top right corner of chrome.
8.  Finally click the icon in the extension toolbar to open the tool.

If the extension doesn't work due to chrome extensions restrictions in your
organization you may be need to generate a key, follow instructions here:
https://developer.chrome.com/apps/manifest/key

Add a new "key" field in manifest.json and set the value to your key.

## User Interface

![Alt text](ui1.png)

In this section we are going to outline the functionality of each element within
the **Settings** panel.

1.  *Domain* - Displays the top level domain for the website in the tab the tool
    was open in.

2.  *Depth (optional)* - Determines how deep in the web page directory path you
    wish for the tool to scrape from the root domain

3.  *Load Time (seconds) (optional)* - This setting determines how long the tool
    allows for a page to load before moving onto the next page. \*It is
    critically important if using the tool in automated mode to choose a page
    load time that would be inclusive of when Google tags fire or use a load
    time that aligns with typical user navigation time.

4.  *URL Suffix* - Optional field to add URL suffix to URL string

5.  *URL File* - Optional field to upload a csv list of URLs for the tool to
    crawl (no URL volume limit)

6.  *Enable Manual Mode - (defaults to off)* - If checked, the tool will run the
    audit in manual mode meaning that it will not automatically visit and scrape
    web pages. Instead it will sit back passively and record any floodlight
    light activity as the user navigates through the website on their Chrome
    tab. This allows a user to audit particular pages, completing actions
    (button click, sign up, test purchase) to record activity based.

7.  *Enable Global Site Tag Verification - (defaults to off)* - If checked, it
    will enable the feature to capture Global Site Tag and cookie information on
    each visited page (compatible with manual and default automatic mode) which
    will be displayed in a separate table similar to the floodlight table.

8.  *Reset Global Site Tag Per Webpage - (defaults to off)* - If checked, this
    will tack on the gclid and gclsrc to each url visited in the audit to make
    sure the Global Site Tag (GST) can fire and cookies can be set properly
    regardless of the entry point to the site. Default tool behavior will only
    set these values on the base page of the audit and test the propagation of
    he GST and cookies across the site.

9.  *Show Page with No Conversion Tags - (defaults to off)* - If checked, tells
    the tool to add an entry in the Conversion Tag Report table for web pages
    that were visited and where no conversion tags were captured. If this
    feature is not activated, by default the tool will only record entries on
    pages where conversion tags were present, leaving out pages with no
    conversion tags.

10. *Run Button* - Will trigger the audit process once it is clicked. After the
    first click, it will be replaced by a Stop button which will terminate the
    audit.

11. *Download Button* - Allows the user to download the audit results as a csv
    file matching the information displayed in the UI. It will download
    Floodlight results and Global Site Tag (if enabled by user) results as
    separate CSV files. Can be clicked at any point during the audit process.

## How to Use It

1.  Navigate to the page from which you want to start with in Chrome, usually
    the websites home page;
2.  Open the tool by clicking the icon from the chrome toolbar;
3.  The Domain is pre-populated based on the domain on the page from which you
    started, you can change it to narrow down the pages that should be crawled;
4.  (OPTIONAL) Check “Enable Manual Mode” you wish to run the audit in manual
    mode. If checked you as the user will need to navigate through the website
    manually.
5.  (OPTIONAL) Check “Enable Global Site Tag Verification” to enable and record
    GST and cookie data during the audit.
6.  (OPTIONAL) Check “Reset Global Site Tag Per Page” if you wish for cookie
    values to be cleared after each page visit and for the gclid and gclsrc
    values to be appended to each webpage.
7.  (OPTIONAL) Check the “Show Pages with No Conversion Tags” in case you want
    the report to include pages that are visited but do not cause floodlight
    tags to be fired. This is particularly useful if you want to determine pages
    that are not being tracked.
8.  Click the Run button, and wait as the crawler starts to visit your site.
    Note, keep the tool popup open, if you close it by clicking anywhere on
    Chrome the process will stop, and you will only get a partial report.
9.  Once the crawling is over and the number of pages visited is the same as the
    number of pages found then the audit will be marked as completed. At this
    point you can click the Download button to export a CSV version of the final
    Floodlight and Global Site Tag report (if enabled).

## Output

1.  *Page* - URL that was crawled for that result
2.  *Tag Type* - Floodlight, Google Ads Conversion Tags, Google Analytics
    Conversion Tags
3.  *Account ID* - Config ID of the associated Global Site Tag
4.  *gTag (Y/N)* - Flag to confirm associated gTag was observed\*
5.  *Network Call* - Network call of the observed tag
6.  *Floodlight ID* - Floodlight Activity ID
7.  *Floodlight Activity Tag* - Floodlight Activity Tag. “Cat=” Parameter value.
8.  *Floodlight Activity Group* - Floodlight Activity Group. “Type=” Parameter
    value
9.  *Floodlight Sales Order* - Order ID or cachebuster random number, depending
    on whether the tag in question is a Sales Tag or a Counter Tag
10. *Floodlight uVariables* - Custom uVariables associated with the floodlight
    in question and whether they pulled in values for that Floodlight fire
11. *Warnings* - Some warnings (like calling out empty uVariables) may be
    expected. We are just highlighting this for you to look into if you wish.
12. *Errors* - Any implementation errors we observe

## Notes

*   \*If you are seeing “False” for the “OGT” Column in the Conversion Tag
    Report section:
    *   Check that the Global Site Tag (gTag) includes the Config ID associated
        to the conversion tag
    *   Ensure the gTag is implemented properly and is firing immediately on
        each page. If there is a delay, the output could show pages as not being
        tagged
    *   Validate that the specific Conversion or Remarketing actions are
        deployed using GTM or a gTag Event Snippet
*   Google Analytics calls are captured with google-analytics.com domains. If it
    is a newer GA4 implementation the calls will not be captured if they are
    hitting analytics.google.com instead of google-analytics.com/g/collect.
