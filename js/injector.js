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
var links = document.documentElement.innerHTML.match(/href="(.*?)"/g);
var result = [];

if(links) {
  for(var i = 0; i < links.length; i++) {
    if(!(
      // anchor tags and same page variants(ex. '/' or '#reviews')
      links[i].match(/^"\/#/g) ||
      links[i].match(/^"\#/g) ||
      links[i].match(/^"\/"$/g) ||
      // misc files
      links[i].match(/[\/\.]?json[\/\"]?/g) ||
      links[i].match(/[\/\.]?js[\/\"]?/g) ||
      links[i].match(/[\/\.]?pdf[\/\"]?/g) ||
      // image files
      links[i].match(/[\/\.]?css[\/\"]?/g) ||
      links[i].match(/[\/\.]?jpg[\/\"]?/g) ||
      links[i].match(/[\/\.]?png[\/\"]?/g) ||
      links[i].match(/[\/\.]?xml[\/\"]?/g) ||
      links[i].match(/[\/\.]?jpeg[\/\"]?/g) ||
      links[i].match(/[\/\.]?gif[\/\"]?/g) ||
      links[i].match(/[\/\.]?webp[\/\"]?/g) ||
      links[i].match(/[\/\.]?svg[\/\"]?/g) ||
      links[i].match(/[\/\.]?svgz[\/\"]?/g) ||
      links[i].match(/[\/\.]?heif[\/\"]?/g) ||
      links[i].match(/[\/\.]?heic[\/\"]?/g) ||
      // icon file
      links[i].match(/[\/\.]?ico[\/\"]?/g) ||
      // font files
      links[i].match(/[\/\.]?otf[\/\"]?/g) ||
      links[i].match(/[\/\.]?ttf[\/\"]?/g) ||
      links[i].match(/[\/\.]?svg[\/\"]?/g) ||
      links[i].match(/[\/\.]?eot[\/\"]?/g) ||
      links[i].match(/[\/\.]?woff[\/\"]?/g) ||
      links[i].match(/[\/\.]?woff2[\/\"]?/g))) {
      result.push(links[i].substring(5));
    }
  }
}

result;
