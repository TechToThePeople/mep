"use strict";

var request = require('request'),
  file = require("fs"),
  cheerio = require('cheerio'),
  cachedRequest = require('cached-request')(request),
  cacheDirectory = "/tmp";

cachedRequest.setCacheDirectory(cacheDirectory);

cachedRequest.setValue('ttl', 100000);
cachedRequest({
  url: 'https://www.europarl.europa.eu/delegations/en/list/byname'
}, function(error, response, html) {
  if (error) {
    console.log("error:" + error);
    process.exit(1)
  }
  const $ = cheerio.load(html);
  var r = {};
  $(".select2-committee option").each(function(i, d) {
    var id = $(this).attr("data-additionaltext");
    if (!id) return;
    r[id.toUpperCase()] = $(this).text();
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl delegations");
    process.exit(1);
  }
  file.writeFileSync("./data/delegations.json", JSON.stringify(r));
});

cachedRequest({
  url: 'https://www.europarl.europa.eu/committees/en/parliamentary-committees.html'
}, function(error, response, html) {
  if (error) {
    console.log("error:" + error);
    process.exit(1)
  }
  console.log("parsing committees");
  const $ = cheerio.load(html);
  var r = {};
  $(".select2-committee option").each(function(i, d) {
    var id = $(this).attr("data-additionaltext");
    if (!id) return;
    r[id.toUpperCase()] = $(this).text();
//    var t = $(this).text().split("\n");
//    r[id]=t[2].substring(5);//replace("\t","");
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl committees");
    process.exit(1);
  }
  file.writeFileSync("./data/committees.json", JSON.stringify(r));
});
