"use strict";

const fs = require("fs");
const path = require("path");

const src = "https://www.europarl.europa.eu/committees/en/about/list-of-committees";
const dest = path.resolve(__dirname,"../data/committees.json");

const fetch = require("node-fetch");
const cheerio = require("cheerio");

const data = require(dest);

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
	
	let changes = 0;
	
	const res = await fetch(src)
	const html = await res.text();
	
	const $ = cheerio.load(html);
	
	$(".erpl_badge-committee","#website-body").each(function(i,e){
		e = $(e);
		let k = e.text().trim();
		let v = e.attr("title").trim().replace(/^(Special )?(Committee|Subcommittee) (of Inquiry )?(on|to) (investigate )?(the )?/g,'').replace(/’/g,'\''); // trim pompousness
		v = v[0].toUpperCase()+v.substr(1);
		
		// show changes
		if (!data.hasOwnProperty(k)) console.log("[update-committees] new: %s - %s", k, v), changes++;
		else if (data[k] !== v) console.log("[update-committees] change: %s - \n←\t'%s'\n→\t'%s'", k, data[k], v), changes++;
		
		data[k] = v;
	});

	console.log("[update-committees] %d change%s", changes, (changes===1)?"":"s");
	
	// save
	fs.writeFile(dest, JSON.stringify(data,null,"\t"), fn);

};

if (require.main === module) main();
