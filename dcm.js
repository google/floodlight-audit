/***********************************************************************
Copyright 2018 Google Inc.

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
var userType = '';
var floodConfigId = '';

var DCM = function(profileId, accountId) {

  function authenticate() {
    return new Promise(function(resolve, reject) {
      try {
        if (profileId == "" || accountId == "") {
          throw 'Missing ProfileID/AccountID, API call will not be performed';
        }
        chrome.identity.getAuthToken({'interactive': true}, function(result) {
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function apiCall(options) {
    return new Promise(function(resolve, reject) {
      try {
        var xhttpr = new XMLHttpRequest();

        xhttpr.onreadystatechange = function() {
          if (xhttpr.readyState === 4) {
            if (xhttpr.status === 200) {
              resolve(JSON.parse(xhttpr.responseText));
            } else {
              var errorResponse = JSON.parse(xhttpr.responseText);
              reject(errorResponse);
            }
          }
        };

        xhttpr.open(options.method, options.url);
        xhttpr.setRequestHeader('Authorization', 'Bearer ' + options.token);
        xhttpr.send();
      } catch(error) {
        reject(error);
      }
    });
  }

  function getUserType(token, profileId) {
    if ( userType == '' ) {
      return apiCall( {
        'method': 'GET',
        'url' : `https://www.googleapis.com/dfareporting/internalv3.2/` +
            `userprofiles/${profileId}/accountUserProfiles/${profileId}`,
        'token': token
      }).then( function (userInfo) {
        userType = userInfo.userAccessType;
      });
    }
    return Promise.resolve();
  }

  function getFloodlightConfigurationId(token, advertiser, profileId) {
    if ( userType != 'SUPER_USER' && floodConfigId == '' ) {
      return apiCall({
        'method': 'GET',
        'url': `https://www.googleapis.com/dfareporting/v3.2/` +
            `userprofiles/${profileId}/advertisers?ids=${advertiser}`,
        'token': token
      }).then( function (advertiserInfo) {
        floodConfigId = advertiserInfo.advertisers[0].floodlightConfigurationId;
      });
    }
    return Promise.resolve();
  }

  function getUrl(profileId, accountId, advertiser,
                  group, activity, floodConfigId) {
    if ( userType == 'SUPER_USER' ) {
      return `https://www.googleapis.com/dfareporting/internalv3.2/` +
          `userprofiles/${profileId}/floodlightActivities?` +
          `accountId=${accountId}&advertiserId=${advertiser}&` +
          `floodlightActivityGroupTagString=${group}&tagString=${activity}`;
    }

    return `https://www.googleapis.com/dfareporting/v3.2/` +
        `userprofiles/${profileId}/floodlightActivities?` +
        `floodlightConfigurationId=${floodConfigId}&` +
        `floodlightActivityGroupTagString=${group}&tagString=${activity}`
  }

  this.getFloodlightIDResponse = function (advertiser, activity,
                                           group, profileId) {
    return authenticate().then(function (token) {
      return getUserType(token, profileId).then(function () {
        return getFloodlightConfigurationId(token, advertiser, profileId)
            .then(function () {
          return apiCall( {
            'method': 'GET',
            'url' : getUrl(profileId,accountId, advertiser,
                group, activity, floodConfigId),
            'token': token
          });
        });
      });
    });
  }

  this.getFloodlightID = function (advertiser, activity, group, profileId) {
    return this.getFloodlightIDResponse(advertiser, activity, group, profileId)
        .then(function (result) {
          if (result.floodlightActivities &&
              result.floodlightActivities.length > 0) {
            for (i = 0; i < result.floodlightActivities.length; i++){
              var thisFloodlight = result.floodlightActivities[i];
              if (thisFloodlight.tagString == activity &&
                  thisFloodlight.floodlightActivityGroupTagString == group){
                return thisFloodlight.id;
              }
            }
          }
          return;
        });
  };

};
