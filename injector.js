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
var links = document.documentElement.innerHTML.match(/href="(.*?)"/g);
var result = [];

if(links) {
  for(var i = 0; i < links.length; i++) {
    if(!(links[i].endsWith("css\"") ||
         links[i].endsWith("jpg\"") ||
         links[i].endsWith("png\"") ||
         links[i].endsWith("xml\"") ||
         links[i].endsWith("ico\"") ||
         links[i].endsWith("jpeg\""))) {
      result.push(links[i].substring(5));
    }
  }
}

result;
