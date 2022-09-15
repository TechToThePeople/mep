"use strict";

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const format = require("util").format;
const quu = require("quu");
const prb = require("prb");

const wd = require("../lib/wikidata");

const dest = path.resolve(__dirname,"../data/wikidata.json");

const ids = require("../data/mepid.json").map(function(r){ return r.id.toString(); });

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

	const result = [];

	wd.getList(function(err, list){
		if (err) return fn(err);
		console.log("[wikidata] retrieved %d objects with mep-id", list.length);

		// filter to only mep ids in our data
		list = list.filter(function(r){
			return ids.includes(r.mepid);
		});

		console.log("[wikidata] found %d relevant objects", list.length);
		
		let n = 0;
		const bar = prb(list.length, {
			prefix: "[wikidata] import",
			precision: 1,
			char: '█',
			width: 80,
		});
		
		const q = quu(5,true);
		list.forEach(function(r){
			q.push(function(next){
				wd.getData(r.wdid, function(err, data){
					bar(++n);
					if (err) return next(err);
					result.push({
						wdid: r.wdid,
						...data
					});
					next();
				});
			});
		});
		
		q.run(function(errs){
			if (Array.isArray(errs) && errs.length > 0) return errs.forEach(function(err){
				console.log("[scrape-wikidata] error: %s", err.toString());
			}), fn(errs[0]);
			console.log("[scrape-wikidata] retrieved %d claims", result.length);
			
			// save
			fs.writeFile(dest, JSON.stringify(result,null,"\t"), fn);
			
		});
	});
	
};

if (require.main === module) main();
