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

class GlobalTagVerification {
    constructor() {
        this.verification_url = '';
        this.verification_tab_id = 0;
        this.isLoading = false;
        this.globalSiteTags = {};
        this.id = 0;
        this.gclid = null;
    }

    setUrl = (url) => {
        this.verification_url = url;
        if(!this.globalSiteTags.hasOwnProperty(url)) {
            this.globalSiteTags[url] = {
                id: this.id,
                url: url,
                tags: [],
                cookies: []
            }
            this.id += 1;
        }
    }

    setTabId = (id) => {
        this.verification_tab_id = id;
    }

    setGclid = (newGclid) => {
        this.gclid = newGclid;
    }

    /**
     * Sets up global tag verification and cookie verification
     * listeners for the current instance.
     *
     */
    globalVerificationSetup = (url, tabId, gclid) => {
        this.setUrl(url);
        this.setTabId(tabId);
        this.setGclid(gclid);
        // add no-cache headers onto outgoing requests to
        // prevent tham from being cached
        chrome.webRequest.onBeforeSendHeaders.addListener(
            this.disableRequestCache,
            { "urls": [
                "http://www.googletagmanager.com/*",
                "https://www.googletagmanager.com/*"
            ] }
        );
        chrome.webRequest.onCompleted.addListener(
            this.verificationProxy,
            { "urls": [
                "http://www.googletagmanager.com/*",
                "https://www.googletagmanager.com/*"
            ] }
        );
        chrome.tabs.onUpdated.addListener(this.cookieVerification);
    }

    /**
     * Resets the GlobalTagVerification instance to
     * its initial state. Removes all listeners, clears
     * global site table in the DOM, and resets instance
     * variables
     *
     */
    globalVerificationReset = () => {
        this.verification_url = '';
        this.verification_tab_id = '';
        this.isLoading = false;
        this.globalSiteTags = {};
        this.id = 0;
        this.removeVerificationListener();
        this.clearGlobalSiteTables();
    }

    /**
     * Removes verification listeners.
     *
     */
    removeVerificationListener = () => {
        // chrome.webRequest.onCompleted.removeListener(this.globalTagVerification)
        chrome.webRequest.onBeforeSendHeaders.removeListener(this.disableRequestCache)
        chrome.webRequest.onCompleted.removeListener(this.verificationProxy)
        chrome.tabs.onUpdated.removeListener(this.cookieVerification)
    }


    /**
     * Clears contents of Global Site Tag table in the DOM.
     *
     */
    clearGlobalSiteTables = () => {
        $('#first-party-cookie-body, #network-call-body, #global-site-panel-url').html("");
    }

    /**
     * Removes all cookies under the given domain.
     *
     * @param {string} url - url associated with cookie
     * @param {string} cookieDomain - specific domain which cookies belong to
     *
     */
    clearFirstPartyCookies = (url, cookieDomain) => {
        chrome.cookies.getAll({ 'domain': cookieDomain }, (cookies) => {
            cookies.forEach(c => {
                chrome.cookies.remove({ 'url': url, 'name': c.name  })
            })
        })
    }

    printGlobalSiteTable = () => {
        var output = 'URL,AccountIDs,Cookies\r\n'
        Object.keys(this.globalSiteTags).forEach(page => {
            var tags = this.globalSiteTags[page].tags.length > 0
                ? `${this.globalSiteTags[page].tags.join('; ')}`
                : null;
            var cookies = this.globalSiteTags[page].cookies.length > 0
                ?  `${this.globalSiteTags[page].cookies.join('; ')}`
                : null;
            output += `${this.globalSiteTags[page].url || 'None'},${tags || 'None'},${cookies || 'None'}\r\n`;
        });
        return output;
    }

    /**
     * Adds table row to specified table element using the row values passed.
     *
     * @param {string} tableName - id of table DOM element
     * @param {string []} rowValues - array of data values to construct row from
     *
     */
    addToGlobalSiteTable = (tableName, rowValues) => {
        var table;
        var row;
        if(tableName === 'first-party-cookie' && rowValues.length > 0) {
            row = "<tr>" // start row
            rowValues.forEach(v => {
                row += `<td>${v}</td>`;
            })
            row += "</tr>" // end row
        } else if(tableName === 'network-call' && rowValues.length > 0) {
            row = "<tr>" // start row
            rowValues.forEach(v => {
                row += `<td>${v}</td>`;
            })
            row += "</tr>" // end row
        }
        table = $(`#${tableName}-body`);
        if(table && row) {
            table.append(row);
        }
    }

    addGlobalSiteTag = (url) => {
        var page_url = decodeURI(url);
        var id = this.globalSiteTags[page_url].id;
        var table = $('#network-call-body');
        // var element = $(`td#${id}_tag`);
        var element = $(`tr#global_tag_${id}`);
        var tags = this.globalSiteTags[page_url].tags.length > 0 ?
            this.globalSiteTags[page_url].tags.join(',</br>') : 'None';
        var cookies = this.globalSiteTags[page_url].cookies.length > 0 ?
            this.globalSiteTags[page_url].cookies.join(',</br>') : 'None';
        var content;
        content = `<td id="${id}_url">${page_url}</td>`;
        content += `<td id="${id}_tag">${tags}</td>`;
        content += `<td id="${id}_cookie">${cookies}</td>`;
        if(element.length > 0) {
            element.html(content);
        } else {
            var row = `<tr id="global_tag_${id}">${content}</tr>`;
            table.append(row);
        }
    }

    /**
     * Formats string of comma seperated domain values and formats it into a regular
     * expression to match them. Return null if there are no user entered domains.
     *
     * @param {string} domains - string of domains, seperated by commas.
     * @returns {string} String representing a regex of all the given domains.
     *
     */
    formatDomains = (domains) => {
        if(!domains) return null;
        var formatted_white_list = domains.split(',')
        if(formatted_white_list.length === 1 && formatted_white_list[0] === '') {
            return null;
        }
        return formatted_white_list.map(
            i => i.trim().replace('.', '\\.')
        ).filter(
            j => j.trim() !== ''
        ).join('|');
    }

    disableRequestCache = (details) => {
        var headers = details.requestHeaders || [];
        headers.push({
            "name": "Cache-Control",
            "value": "no-cache"
        });
        return {requestHeaders: headers};
    }

    /**
     * Pulls all necesary form data to funnel network event into the global
     * tag verification function with the proper parameters based on the domain
     * the event originated from and user settings.
     *
     * @param {Event} event - webrequest chrome event.
     *
     */
    verificationProxy = (event) => {
        var verification_enabled = document.getElementById("enable_tag_verification").checked;
        var manual_set = document.getElementById("enable_manual").checked;
        if(verification_enabled) {
            var domain_regex = new RegExp(`${domain.replace('.', '\\.')}`);
            if(manual_set) {
                if(event.initiator.match(domain_regex)) {
                    this.globalTagVerification(event, event.tabId)
                }
            } else {
                this.globalTagVerification(event, this.verification_tab_id)
            }
        }
    }

    /**
     * Sets Global Site Tag panel url and delegates event to parseTagmanager function.
     *
     * @param {Event} event - webrequest chrome event.
     * @param {number} tab_id - id of the tab from which the request originated.
     *
     */
    globalTagVerification = (event, tab_id) => {
        chrome.tabs.get(tab_id, (t) => {
            // $('#global-site-panel-url').html(t.url);
            var page_url = decodeURI(t.url);
            if(!this.globalSiteTags.hasOwnProperty(page_url)) {
                this.globalSiteTags[page_url] = {
                    id: this.id,
                    url: page_url,
                    tags: [],
                    cookies: []
                }
                this.id += 1;
            }
            this.parseTagManager(page_url, event);
        });
    }

    /**
     * Parses web request url, if it originates from Google Tag Manager,
     * for accountId and network call status. Passes results to be written
     * out to table.
     *
     * @param {Event} event - webrequest chrome event.
     *
     */
    parseTagManager = (page_url, event) => {
        var u = event.url;
        var val;
        if(u.match(/googletagmanager\.com/)) {
            // previous logic - u.match(/js\?id\=([\w-]*)/) && event.statusCode === 200
            val = u.match(/js\?id\=([\w-]*)/);
            if(val) {
                if(this.globalSiteTags[page_url].tags.indexOf(val[1]) === -1) {
                    this.globalSiteTags[page_url].tags.push(val[1]);
                    this.addGlobalSiteTag(page_url);
                }
            }
        }
    }

    /**
     * Recieves any chrome tab update filtering for only updates to window location.
     * Delegates tab updates to cookie scraping function if tab meets user criteria.
     *
     * Reference chrome.tabs.onUpdated.addListener:
     * https://developer.chrome.com/extensions/tabs#event-onUpdated
     *
     * @param {string} id - ID of updated tab.
     * @param {Object} changeInfo - Lists the changes to the state of the tab that was updated.
     * @param {Object} tab - Gives the state of the tab that was updated.
     *
     */
    cookieVerification = (updated_tab_id, changeInfo, tab) => {
        // +++++++++ DO NOT REMOVE - may revisit this logic in the future +++++++++ //
        // ++++++++++++++ Also used int verificationProxy() function ++++++++++++++ //
        // var linked_domains = document.getElementById('linked-domains').value;
        // var linked_domain_list = this.formatDomains(linked_domains);
        // var domain_regex = linked_domain_list ?
        //     new RegExp(`(\w*\d*.)?${domain.replace('.', '\\.')}|${linked_domain_list}`):
        //     new RegExp(`(\w*\d*.)?${domain.replace('.', '\\.')}`);
        // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ //
        
        var verification_enabled = document.getElementById("enable_tag_verification").checked;
        var tag_reset_enabled = document.getElementById("enable_tag_reset").checked;
        var manual_set = document.getElementById("enable_manual").checked;
        
        if(verification_enabled) {
            // generate regex to match incoming tab url with top level domain
            var tab_url =  decodeURI(tab.url);
            var domain_regex = new RegExp(`(\w*\d*\.)?${domain.replace('.', '\\.')}`);
            var domain_match = tab_url.match(domain_regex)
            if (manual_set) {
                if(changeInfo.status === 'complete' && domain_match) {
                    this.updateCookies(domain, tab_url);
                }
            } else {
                if(updated_tab_id === this.verification_tab_id){
                    if(tag_reset_enabled && changeInfo.status === 'loading' && changeInfo.url) {
                        this.clearFirstPartyCookies(tab_url, domain);
                    }else if(changeInfo.status && domain_match) { //&& tab_url === verification_url) {
                        this.updateCookies(domain, tab_url);
                    }
                }
            }
        }
    }


    /**
     * Fetches all cookies that match the passed domain parameter and parses
     * through to find first party doubleclick/adword cookies.
     *
     * @param {string} current_domain - cookie domain.
     *
     */
    updateCookies = (current_domain, url) => {
        // var gclid = $('#gclid').val() !== '' ? $('#gclid').val() : null;
        chrome.cookies.getAll({ domain: current_domain }, (cks) => {
            var cookie_map = {
                dc_cookie: null,
                aw_cookie: null
            }
            cks.forEach(c => {
                // if cookie name matches _gcl_dc/_gcl_aw and its values contains
                // the gclid value, capture it.
                if(c.name.indexOf('_gcl_dc') >= 0 && c.value.indexOf(this.gclid) >= 0) {
                    cookie_map.dc_cookie = c;
                }
                if(c.name.indexOf('_gcl_aw') >= 0 && c.value.indexOf(this.gclid) >= 0) {
                    cookie_map.aw_cookie = c;
                }
            });
            if(!this.globalSiteTags.hasOwnProperty(url)) {
                this.globalSiteTags[url] = {
                    id: this.id,
                    url: url,
                    tags: [],
                    cookies: []
                }
                this.id += 1;
            }
            var cookie_value;
            if(cookie_map.dc_cookie){
                cookie_value = `${cookie_map.dc_cookie.name}=${cookie_map.dc_cookie.value}`;
                if (this.globalSiteTags[url].cookies.indexOf(cookie_value) === -1) {
                    this.globalSiteTags[url].cookies.push(cookie_value);
                    this.addGlobalSiteTag(url);
                }
            }
            if(cookie_map.aw_cookie) {
                cookie_value = `${cookie_map.aw_cookie.name}=${cookie_map.aw_cookie.value}`;
                if (this.globalSiteTags[url].cookies.indexOf(cookie_value) === -1) {
                    this.globalSiteTags[url].cookies.push(cookie_value);
                    this.addGlobalSiteTag(url);
                }
            }
        });
    }

}
