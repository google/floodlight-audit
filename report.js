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
$(document).ready(function() {
  var table = $("#report");
  var report = JSON.parse(localStorage.getItem("report"));

  for(var i = 0; i < report.length; i++) {
    var tag = report[i];

    var row = "<tr>";

    row += "<td>" + tag.url + "</td>";
    row += "<td>" + tag.advertiser + "</td>";
    row += "<td>" + tag.floodlightId + "</td>";
    row += "<td>" + tag.floodlightUrl + "</td>";
    row += "<td>" + tag.activity + "</td>";
    row += "<td>" + tag.group + "</td>";
    row += "<td>" + tag.order + "</td>";
    row += "</tr>";

    table.append(row);
  }
});
