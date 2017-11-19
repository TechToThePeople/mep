"use strict";

var request = require('request'),
  file = require("fs"),
  cheerio = require('cheerio'),
  cachedRequest = require('cached-request')(request),
  cacheDirectory = "/tmp";

cachedRequest.setCacheDirectory(cacheDirectory);

cachedRequest.setValue('ttl', 100000);
cachedRequest({
  url: 'http://www.europarl.europa.eu/delegations/en/home.html'
}, function(error, response, html) {
  if (error) {
    console.log("error:" + error);
    process.exit(1)
  }
  const $ = cheerio.load(html);
  var r = {};
  $("#navigation-selectmenu-field option").each(function(i, d) {
    var id = $(this).attr("data-additionaltext");
    if (!id) return;
    r[id] = $(this).text();
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl");
    process.exit(1);
  }
  file.writeFileSync("./data/delegations.json", JSON.stringify(r));
});

cachedRequest({
  url: 'http://www.europarl.europa.eu/committees/en/home.html'
}, function(error, response, html) {
  if (error) {
    console.log("error:" + error);
    process.exit(1)
  }
  const $ = cheerio.load(html);
  var r = {};
  $(".js_selectmenu_committees option").each(function(i, d) {
    var id = $(this).attr("value");
    if (!id) return;
    r[id] = $(this).attr("title");
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl");
    process.exit(1);
  }
  file.writeFileSync("./data/committees.json", JSON.stringify(r));
});
