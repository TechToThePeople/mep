"use strict";

var request = require('request'),
  file = require("fs"),
  cheerio = require('cheerio'),
  cachedRequest = require('cached-request')(request),
  cacheDirectory = "/tmp";

cachedRequest.setCacheDirectory(cacheDirectory);

cachedRequest.setValue('ttl', 100000);
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
  $(".es_select-organ").find('option').each(function(i, d) {
    const dom = $(this);
    const name = dom.text();
    const id = dom.val();
    console.log(name,id);
    if (!id || id ==='placeholder') return;
    r[id.toUpperCase()] = name;
//    var t = $(this).text().split("\n");
//    r[id]=t[2].substring(5);//replace("\t","");
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl committees");
    process.exit(1);
  }
  file.writeFileSync("./data/committees.json", JSON.stringify(r, null, 2));
});

cachedRequest({
  url: 'https://www.europarl.europa.eu/delegations/en/list/byname'
}, function(error, response, html) {
  if (error) {
    console.log("error:" + error);
    process.exit(1)
  }
  const $ = cheerio.load(html);
  var r = {};
  $("div.erpl_title-h3").each(function(i, d) {
    const a = $(this).find('a.t-y');
    const name = a.text();
    const id = a.attr("href").replace("/delegations/en/","");
    console.log(name,id);
    if (!id) return;
    r[id.toUpperCase()] = name;
  });
  if (Object.keys(r).length < 10) {
    console.log("can't parse europarl delegations");
    process.exit(1);
  }
  file.writeFileSync("./data/delegations.json", JSON.stringify(r, null, 2));
});

