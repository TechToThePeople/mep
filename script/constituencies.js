"use strict";

const fs = require("fs");
const path = require("path");

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const quu = require("quu");
const wsv = require("wsv");

const src = "https://www.europarl.europa.eu/meps/en/search/advanced";
const dest_mep = path.resolve(__dirname,"../data/mep_regions.csv");
const dest_regions = path.resolve(__dirname,"../data/regions.csv");

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

	const q = quu(1,true);
	
	const countries = {};
	
	// fetch countries
	q.push(async function(next){

		console.log("[constituencies] fetch index");
		const res = await fetch(src)
		const html = await res.text();
		const $ = cheerio.load(html);

		$("option", "#mepSearchCountrySelectField").map(function(i,e){
			return $(e).attr("value").trim();
		}).toArray().filter(function(v){
			return !!v;
		}).forEach(function(v){
			countries[v] = {};
		});

		Object.keys(countries).forEach(function(country){
			q.push(async function(next){
				
				console.log("[constituencies] fetch country %s", country);
				const res = await fetch(src+"?countryCode="+country);
				const html = await res.text();
				const $ = cheerio.load(html);
				
				$("option", "#mepSearchConstituencySelectField").map(function(i,e){
					return $(e).attr("value").trim();
				}).toArray().filter(function(v){
					return !!v;
				}).forEach(function(v){
					countries[country][v] = [];
				});
				
				Object.keys(countries[country]).forEach(function(constituency){
					q.push(async function(next){
						
						console.log("[constituencies] fetch country %s constituency '%s'", country, constituency);
						const res = await fetch(src+"?countryCode="+country+"&constituency="+encodeURIComponent(constituency)+"&bodyType=ALL	");
						const html = await res.text();
						const $ = cheerio.load(html);
						
						// add members 
						$(".erpl_member-list-item-content").each(function(i,e){
							e = $(e);
							countries[country][constituency].push({
								country: country,
								region: constituency,
								mepid: e.attr("href").split("/").pop(),
								name: $(".erpl_title-h5", e).text().trim(),
							});
						});
						
						next();
						
					});
				})
				
				next();
				
			});
		});

		next();
				
	});
	
	q.run(function(errs){
		
		const out_mep = fs.createWriteStream(dest_mep);
		const csv_mep = wsv("csv");
		csv_mep.pipe(out_mep);

		const out_regions = fs.createWriteStream(dest_regions);
		const csv_regions = wsv("csv");
		csv_regions.pipe(out_regions);
		
		Object.keys(countries).forEach(function(country){
			Object.keys(countries[country]).forEach(function(constituency){

				csv_regions.write({
					country: country,
					region: constituency,
					meps: Object.keys(countries[country][constituency]).length,
				});
				
				countries[country][constituency].forEach(function(v){
					csv_mep.write(v);
				});
			
			});
		});
		
		// close destinations
		csv_mep.end(function(){
			csv_regions.end(function(){
				console.log("[constituencies] done");
				fn();
			});
		});
		
	});

};

if (require.main === module) main();
