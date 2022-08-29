"use strict";

const fs = require("fs");
const path = require("path");

const src = "https://www.europarl.europa.eu/delegations/en/list/byname";
const dest = path.resolve(__dirname,"../data/delegations.json");

const fetch = require("node-fetch");
const cheerio = require("cheerio");

const data = require(dest);

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
	
	let changes = 0;
	
	const res = await fetch(src)
	const html = await res.text();
	
	const $ = cheerio.load(html);
	
	if ($("div.erpl_title-h3","#website-body").map(function(i,e){
		e = $(e);
		let k = $("a",e).eq(0).attr("href").split("/").pop().trim().toUpperCase();
		let v = e.text().trim().replace(/’/g,'\'');

		if (!k) return console.log("[update-delegations] could not find acronym for '%s'", v);

		// show changes
		if (!data.hasOwnProperty(k)) console.log("[update-delegations] new: %s - %s", k, v), changes++;
		else if (data[k] !== v) console.log("[update-delegations] change: %s - \n←\t'%s'\n→\t'%s'", k, data[k], v), changes++;
		
		data[k] = v;
		
		return k;
	}).toArray().length < 10) return console.log("[update-delegations] could not find enough delegations"), process.exit();

	console.log("[update-delegations] %d change%s", changes, (changes===1)?"":"s");
	
	// save
	fs.writeFile(dest, JSON.stringify(data,null,"\t"), fn);

};

if (require.main === module) main();
