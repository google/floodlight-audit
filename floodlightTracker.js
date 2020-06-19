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


class FloodlightTracker {
    constructor(profileId, accountId, gclid, showNoFloodlight) {
        this.tracker = {};
        this.counter = 0;
        this.gclid = gclid || '';
        this.dcmProfileId = profileId || '';
        this.dcmAccountId = accountId || '';
        this.show_no_floodlight = showNoFloodlight || false;
        this.dcm = null;
    }

    setGclid = (gclid) => {
        this.gclid = gclid || this.gclid;
    }

    setDcmInformation = (profileID, accountID) => {
        this.dcmProfileId = profileID || this.dcmProfileId;
        this.dcmAccountId = accountID || this.dcmAccountId;
        this.dcm = new DCM(this.dcmProfileId, this.dcmAccountId);
    }

    setShowNoFloodlight = (value) => {
        this.show_no_floodlight = value || this.show_no_floodlight;
    }

    addToTracker = (domain, mode, url, event, floodlightConfigId) => {
        var page_url = decodeURI(url);
        if(!page_url.match(new RegExp(domain))) {
            return;
        }
        if(mode === 'doubleclick') {
            this.extractDCMFloodlightData(page_url, event, floodlightConfigId);
        } 
    }
    
    addEmptyTrackerEntry = (mode, url) => {
        var page_url = decodeURI(url);
        if(!this.tracker[page_url]) {
            console.log('Add empty entry to tracker for: ',  page_url);
            this.tracker[page_url] = {};
            var id = uuidv4();

            if(mode === 'doubleclick'){
                this.tracker[page_url][0] = {
                    id: id,
                    page_url: page_url,
                    floodlights: [],
                    advertiser: 'None',
                    // network_call_verification: 'None',
                    // network_call_detail: '',
                    activity: 'None',
                    group: 'None',
                    uvars: 'None',
                    order: 'None',
                    event_snippet: 'None',
                    floodlight_cookie: 'None',
                    google_ads_cookie: 'None',
                    auiddc: 'None',
                    floodlight_id: null,
                    warnings: 'None',
                    errors: 'No floodlight(s) detected'
                };
            } 
            this.addToTable(mode, this.tracker[page_url][0]);
        }
    }

    extractDCMFloodlightData = (page_url, event, floodlightConfigId) => {
        var data = null;
        var floodlight_url = event.url;
        var fl_advertiser = floodlight_url.match(/src=(\w*)/) ? // Note - this is also used as the Floodlight Config ID
        floodlight_url.match(/src=(\w*)/)[1] : null;

        // Check for a match between Floodlight config ID list and advertiser ID -- return null here if there is not a match
        if (floodlightConfigId.length > 0 && !floodlightConfigId.includes(fl_advertiser)) {
            return null;
        }

        // cat = FL activity tag string (or, “Activity tag string” value in SA360 or Campaign Manager UI)
        var activity = floodlight_url.match(/cat=(\w*)/) ?
        floodlight_url.match(/cat=(\w*)/)[1] : null;

        // type = is the FL activity group string (or, “Floodlight activity group” value in SA360 or Campaign Manager UI)
        var group = floodlight_url.match(/type=(\w*)/) ?
        floodlight_url.match(/type=(\w*)/)[1] : null;

        // gtm = denotes that this is an event snippet
        var event_snippet = floodlight_url.match(/gtm=(\w*)/) ? true : false
        // floodlight_url.match(/gtm=(\w*)/)[1] : null;

        // gcldc = floodlight cookie
        var floodlight_cookie = floodlight_url.match(/gcldc=([\w-\*]+)/) ?
        floodlight_url.match(/gcldc=([\w-\*]+)/)[1] : null;

        // gclaw = google ads cookie
        var google_ads_cookie = floodlight_url.match(/gclaw=([\w-\*]+)/)
        ? floodlight_url.match(/gclaw=([\w-\*]+)/)[1] : null;

        // auiddc = ID used to map gclids for non last click attribution
        var auiddc = floodlight_url.match(/auiddc=([\w\.]*)/)
        ? floodlight_url.match(/auiddc=([\w\.]*)/)[1] : null;

        var uvars = JSON.stringify(floodlight_url.match(/u[0-9]*=(\w*)/g)).replace(/"/g, '') || null;

        var order = floodlight_url.match(/ord=([\d\.]*)/)
        ? floodlight_url.match(/ord=([\d\.]*)/)[1] : null;

        // @TODO - this statement may filter out adservice calls that come in with minial data
        if(!fl_advertiser && !activity && !group) {
            return null;
        }

        var floodlight_uuid = `${fl_advertiser}_${activity}_${group}`;
        var id = uuidv4();
        data = {
            id: id,
            page_url: page_url,
            floodlights: [{ url: floodlight_url, network_call_status: event.statusCode }],
            advertiser: fl_advertiser,
            // network_call_verification: '',
            // network_call_detail: '',
            floodlight_id: null,
            activity,
            group,
            uvars,
            order,
            event_snippet,
            floodlight_cookie,
            google_ads_cookie,
            auiddc,
            warnings: null,
            errors: null
        }

        if(!this.tracker.hasOwnProperty(page_url)){
            this.tracker[page_url] = {};
        }
        // const debouncedVerification = debounce(this.floodlightVerification, 500);
        
        if(!this.tracker[page_url].hasOwnProperty(floodlight_uuid)) {
            this.tracker[page_url][floodlight_uuid] = data;
            this.counter += 1;
            this.extractWarnings(this.tracker[page_url][floodlight_uuid]);
            this.addToTable('doubleclick', this.tracker[page_url][floodlight_uuid]);
            this.dcmVerification(this.tracker[page_url][floodlight_uuid]);
        } else {
            this.tracker[page_url][floodlight_uuid].floodlights.push({
                url: floodlight_url,
                network_call_status: event.statusCode,
            });
            this.extractWarnings(this.tracker[page_url][floodlight_uuid]);
            // this.floodlightVerification(this.tracker[page_url][floodlight_uuid]);
        }
        // this.floodlightVerification(this.tracker[page_url][floodlight_uuid]);
        this.updateTracker('doubleclick', this.tracker[page_url][floodlight_uuid]);
    }

    extractWarnings = (floodlight_obj) => {
        var warning_str = ''
        if(!floodlight_obj.advertiser) {
            warning_str += '- Missing advertiser value.<br/>';
        }
        if(!floodlight_obj.activity) {
            warning_str += '- Missing activty tag string value.<br/>';
        }
        if(!floodlight_obj.group) {
            warning_str += '- Missing activity group string value.<br/>';
        }
        if(!floodlight_obj.uvars) {
            warning_str += '- No Uvar values were found.<br/>';
        } else {
            var uvars = floodlight_obj.uvars.replace(/(\[|\])/g, '').split(',');
            uvars.forEach((vars) => {
                var matches = vars.match(/(u\d*)=(.*)/);
                if(matches){
                    if(
                        matches[2] === 'undefined' ||
                        matches[2] === 'null' ||
                        matches[2] === ''
                    ) {
                        warning_str += `- ${matches[1]} value may be missing.<br/>`;
                    }
                } else {
                    warning_str += '- No Uvar values were found.<br/>';
                }
            })
        }
        if(!floodlight_obj.order) {
            warning_str += '- Missing sales order value.<br/>';
        }
        if(!floodlight_obj.event_snippet) {
            warning_str += '- Missing event snippet value.<br/>';
        }
        // if(!floodlight_obj.floodlight_cookie) {
        //     warning_str += '- No floodlight cookie value captured.<br/>';
        // }
        // if(!floodlight_obj.google_ads_cookie) {
        //     warning_str += '- No google ads cookie value captured.<br/>';
        // }
        // if(!floodlight_obj.auiddc) {
        //     warning_str += '- Missing auiddc value.<br/>';
        // }
        if(warning_str === '') {
            floodlight_obj.warnings = null;
        } else {
            floodlight_obj.warnings = warning_str;
        }
    }

    extractGAFloodlightData = (page_url, floodlight_url) => {
        var matchId = floodlight_url.match(/tid=([\w-]*)/);
        var matchIteraction = floodlight_url.match(/t=([\w-]*)/);
        if (!matchId || !matchIteraction) {
            return; //nothing to process
        }

        var id = uuidv4();

        if(!this.tracker.hasOwnProperty(page_url)){
            this.tracker[page_url] = {};
        }
        if(!this.tracker[page_url].hasOwnProperty(matchId[1])) {
            this.tracker[page_url][matchId[1]] = {
                id: id,
                page_url: page_url,
                gaId: matchId ? matchId[1] : '',
                interactionType: matchIteraction ? matchIteraction[1] : ''
            };
            this.counter += 1;
            this.addToTable('ga', this.tracker[page_url][matchId[1]]);
        }
    }

    updateTracker = (mode, floodlight_obj) => {
        var tableRow = $(`#${floodlight_obj.id}`);
        if(tableRow) {
            var newContent = this.renderTrackerRow(mode, floodlight_obj);
            tableRow.replaceWith(newContent);
        }
    }

    addToTable = (mode, floodlight_obj) => {
        var table;
        var row = this.renderTrackerRow(mode, floodlight_obj);
        if(mode === 'doubleclick') {
            table = $('#floodlight-dcm-report-body');
        }
        if(table && row) {
            table.append(row);
        } else {
            console.warn('Oops! Either I could not find the table or your row was empty');
        }
    }

    renderTrackerRow = (mode, floodlight_obj) => {
        var rowString;
        var row = floodlight_obj;
        if(mode === 'doubleclick') {
            rowString = `<tr id="${row.id}">`;
            rowString += `<td id="${row.id}-page-url">${row.page_url || 'None'}</td>`;
            rowString += `<td id="${row.id}-advertiser">${row.advertiser || 'None'}</td>`;
            rowString += `<td id="${row.id}-floodlight-id">${row.floodlight_id ?
                `<a target="_blank" href="${getCMLink(this.dcmAccountId, row.advertiser, row.floodlight_id)}">${row.floodlight_id}</a>` :
                'None'}</td>`;
            rowString += `<td id="${row.id}-activity">${row.activity || 'None'}</td>`;
            rowString += `<td id="${row.id}-group">${row.group || 'None'}</td>`;
            rowString += `<td id="${row.id}-order">${row.order || 'None'}</td>`;
            // rowString += `<td id="${row.id}-network-call">${row.network_call_verification || 'None'}</td>`;//${tooltip}</td>`;
            rowString += `<td id="${row.id}-event-snippet">${typeof row.event_snippet === 'boolean' ? row.event_snippet : 'None'}</td>`;
            // rowString += `<td id="${row.id}-floodlight-cookie">${row.floodlight_cookie || 'None'}</td>`;
            // rowString += `<td id="${row.id}-google-ads-cookie">${row.google_ads_cookie || 'None'}</td>`;
            // rowString += `<td id="${row.id}-auiddc">${row.auiddc || 'None'}</td>`;
            rowString += `<td id="${row.id}-uvars">${row.uvars || 'None'}</td>`;
            rowString += `<td id="${row.id}-warnings" style="color: rgb(235,182,62);">${row.warnings || 'None'}</td>`;
            rowString += `<td id="${row.id}-errors" style="color: rgb(216,80,64);">${row.errors || 'None'}</td>`;
            rowString += '</tr>';
        }
        return rowString;
    }

    printTracker = (mode) => {
        var output = "";
        if (mode == 'doubleclick') {
            // Removed Network Calls Verified,Floodlight Coookie,Google Ads Cookie,auiddc,
            output = 'Page,Floodlight Advertiser,Floodlight ID,Floodlight Activity,Floodlight Activity Group,Sales Order,Event Snippet,U Variables,Warnings,Errors\r\n';
            Object.keys(this.tracker).forEach(page => {
                Object.keys(this.tracker[page]).forEach(fl => {
                var flood = this.tracker[page][fl];
                var url = encodeURI(flood.page_url);
                url = url.replace(/#/g, '%23');
                // "${flood.network_call_verification ? flood.network_call_verification.replace(/<br\/>/g, ' ') : 'None'}",
                // "${flood.floodlight_cookie || 'None'}","${flood.google_ads_cookie || 'None'}",
                // "${flood.auiddc || 'None'}",
                output += `"${url || 'None'}","${flood.advertiser || 'None'}","${flood.floodlight_id ? getCMLink(this.dcmAccountId, flood.advertiser, flood.floodlight_id) : 'None'}",` +
                `"${flood.activity || 'None'}","${flood.group || 'None'}","${flood.order || 'None'}","${flood.event_snippet || 'None'}","${flood.uvars || 'None'}",` +
                `"${flood.warnings ? flood.warnings.replace(/<br\/>/g, ' ') : 'None'}","${flood.errors ? flood.errors.replace(/<br\/>/g, ' ') : 'None'}"\r\n`;
                });
            });
        }
        return output;
    }

    clearTracker = () => {
        $('#floodlight-dcm-report-body').html("");
        Object.keys(this.tracker).forEach(page => {
            Object.keys(this.tracker[page]).forEach(floodlight => {
                delete this.tracker[page][floodlight];
            });
            delete this.tracker[page];
        });
        this.counter = 0;
    }

    dcmVerification = (floodlight_obj) => {
        if(floodlight_obj) {
            if(this.dcmProfileId) {
                this.dcm.getFloodlightID(
                    floodlight_obj.advertiser,
                    floodlight_obj.activity,
                    floodlight_obj.group,
                    this.dcmProfileId)
                    .then((floodlight_id) => {
                        if (!floodlight_obj.floodlight_id && floodlight_id) {
                            floodlight_obj.floodlight_id = floodlight_id;
                            // getCMLink(
                            //     floodlight_obj.dcmAccountId, 
                            //     floodlight_obj.advertiser,
                            //     floodlight_obj.floodlight_id
                            // );
                            this.updateTracker('doubleclick', floodlight_obj);
                        }
                    }).catch(res => console.log('Error during api call: ', res));
            }
        }
    }

    floodlightVerification = (floodlight_obj) => {//debounce((floodlight_obj) => {
        var verify1 = 'Doubleclick 302 Not Found';
        var verify2 = 'Doubleclick 200 Not Found';
        var verify3 = 'Ad Service 200 Not Found';
        var network_errors = '';
        floodlight_obj.floodlights.forEach(fl => {
          var doubleClick = fl.url.match(/fls\.doubleclick\.net/);
          var adService = fl.url.match(/adservice\.google\.com/);
          var floodlight_cookie = '';
          var google_ads_cookie = '';
          // find gldc value when it equals a alphanumeric string
          if((doubleClick || adService) && fl.url.match(/gcldc=([\w-]+)/)) {
            floodlight_cookie = fl.url.match(/gcldc=([\w-]+)/)[1];
          }
          // find gldc value when it equals '*'
          if ((doubleClick || adService) && fl.url.match(/gcldc=(\*+)/)) {
            floodlight_cookie = '*';
          }

          // find glaw value when it equals a alphanumeric string
          if((doubleClick || adService) && fl.url.match(/gclaw=([\w-]+)/)) {
            google_ads_cookie = fl.url.match(/gclaw=([\w-]+)/)[1];
          }

          // find gclaw value when it equals '*'
          if ((doubleClick || adService) && fl.url.match(/gclaw=(\*+)/)) {
            google_ads_cookie = '*';
          }

          // verifies 1st Doubleclick network calls
          if(doubleClick) {
            if(fl.network_call_status === 302) {
                if(floodlight_cookie !== this.gclid) {
                    network_errors += '- 302 Doubleclick call did not have gcldc properly set.<br/>';
                    verify1 = 'Doubleclick 302 Warning'
                }
                if(google_ads_cookie !== this.gclid) {
                    network_errors += '- 302 Doubleclick call did not have gclaw properly set.<br/>'
                    verify1 = 'Doubleclick 302 Warning'
                }
                if (floodlight_cookie === this.gclid && google_ads_cookie === this.gclid) {
                    verify1 = 'Doubleclick 302 OK';
                }
            } else if(fl.network_call_status === 200) {
                if(floodlight_cookie !== this.gclid) {
                    network_errors += '- 200 Doubleclick call did not have gcldc properly set.<br/>';
                    verify2 = 'Doubleclick 200 Warning'
                }
                if(google_ads_cookie !== this.gclid) {
                    network_errors += '- 200 Doubleclick call did not have gclaw properly set.<br/>'
                    verify2 = 'Doubleclick 200 Warning'
                }
                if (floodlight_cookie === this.gclid && google_ads_cookie === this.gclid) {
                    verify2 = 'Doubleclick 200 OK';
                }
            }
          }
          // verifies Ad Service network call
          if(adService && fl.network_call_status === 200) {

            if(floodlight_cookie !== '*') {
                network_errors += '- 200 AdService call did not have gcldc properly set.<br/>';
                verify3 = 'Ad Service 200 Warning'
            }
            if(google_ads_cookie !== '*') {
                network_errors += '- 200 AdService call did not have gclaw properly set.<br/>';
                verify3 = 'Ad Service 200 Warning'
            }
            if (floodlight_cookie === '*' && google_ads_cookie === '*') {
                verify3 = 'Ad Service 200 OK';
            }
          }
        });
        network_errors = verify3.includes('Not Found') ? `- Ad Service 200 Not Found.<br/>${network_errors}` : network_errors;
        network_errors = verify2.includes('Not Found') ? `- Doubleclick 200 Not Found.<br/>${network_errors}` : network_errors;
        network_errors = verify1.includes('Not Found') ? `- Doubleclick 302 Not Found.<br/>${network_errors}` : network_errors;
        
        // floodlight_obj.network_call_detail = network_errors.replace(/<br\/>/g, '&#10;');  
        floodlight_obj.errors = network_errors;
        floodlight_obj.network_call_verification = [verify1, verify2, verify3].join('<br/>');
        this.updateTracker('doubleclick', floodlight_obj);
    }
    //, 300)

}
