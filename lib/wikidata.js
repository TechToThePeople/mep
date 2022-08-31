"use strict";

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const quu = require("quu");
const format = require("util").format;

const headers = { "User-Agent": "mep/0.0 (https://github.com/TechToThePeople/mep; scraper@tttp.eu) scrape-wikidata.js/0.0" };

// wikidata query; any item that has P1186 → MEP directory ID
const query_list = "SELECT ?item (sample(?mepid_) as ?mepid) WHERE { ?item p:P1186 ?statement0. ?item wdt:P1186 ?mepid_. } GROUP BY ?itemLabel ?item";
const query_data = "SELECT ?wdLabel ?ps_Label { VALUES (?company) {(wd:%s)} ?company ?p ?statement . ?statement ?ps ?ps_ . ?wd wikibase:claim ?p. ?wd wikibase:statementProperty ?ps. SERVICE wikibase:label { bd:serviceParam wikibase:language 'en' }}";

const src_sparql = "https://query.wikidata.org/sparql?query=%s&format=json"; // format(src_sparql, encodeURIComponent(query_mep));
	
const getJSON = module.exports.getJSON = function(url, fn){
	fetch(url, { headers: headers }).then(function(res){
		res.text().then(function(data){
			try {
				data = JSON.parse(data);
			} catch (err) { return fn(err); };
			
			return fn(null, data);
		}).catch(fn);
	}).catch(fn);
};

const getList = module.exports.getList = function(fn){
	getJSON(format(src_sparql, encodeURIComponent(query_list)), function(err, data){
		if (err) return fn(err);
		return fn(null, data.results.bindings.map(function(r){
			return {
				wdid: r.item.value.substr(r.item.value.lastIndexOf("/")+1),
				mepid: r.mepid.value
			}
		}));
	});
};

const getData = module.exports.getData = function(wdid, fn){
	getJSON(format(src_sparql, encodeURIComponent(format(query_data, wdid))), function(err, data){
		if (err) return fn(err);
		return fn(null, data.results.bindings.reduce(function(d,r){
			if (d.hasOwnProperty(r.wdLabel.value)) {
				if (!Array.isArray(d[r.wdLabel.value])) d[r.wdLabel.value] = [ d[r.wdLabel.value] ];
				if (!d[r.wdLabel.value].includes(r.ps_Label.value)) d[r.wdLabel.value].push(r.ps_Label.value);
			} else {
				d[r.wdLabel.value] = r.ps_Label.value;
			}
			return d;
		},{}));
	});
};
