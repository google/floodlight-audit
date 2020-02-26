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

function ReportEntries() {

  this.map = new Map();

  function computeEntrytKey(entry, mode) {
    return entry.url + entry.advertiser + entry.activity + entry.group;
  }

  this.add = function add(entry, mode) {
    var key = computeEntrytKey(entry, mode);
    if (!this.map.has(key)) {
      this.map.set(key, entry);
    }
  };

  this.getReportEntries = function getReports() {
    return this.map.values();
  };

  this.length = function length() {
    return this.map.size;
  };

}
