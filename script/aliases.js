"use strict";

const fs = require("fs");
const path = require("path");
const jsonstream = require("JSONStream");
const stream = require("stream");
const quu = require("quu");
const xsv = require("xsv");
const wsv = require("wsv");

// data
const mepid = require("../data/mepid.json");
const mepids = mepid.map(function(r){ return r.id }); // ids only for quicker lookup
const countries = require("../data/country2iso.json");

const src = path.resolve(__dirname,"../data/ep_meps_current.json");

const spinner = "▁▂▃▄▅▆▇█▇▆▅▄▃▂".split("");

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
	
	const q = quu(1,true);

	// count records
	let processed = 0;
	let total = 0;
	
	// preload gender
	const gender = {};
	q.push(function(next){
		fs.createReadStream(path.resolve(__dirname,"../data/meps.nogender.csv")).pipe(xsv({ sep: "," }).on("data", function(r){
			gender[r.epid] = r.gender;
		}).on("end", function(){
			console.log("[aliases] gender loaded");
			next();
		}));
	});
	
	q.push(function(next){

		// prepare dest
		const out = fs.createWriteStream(path.resolve(__dirname,"../data/meps-aliases.csv"));
		const csv = wsv({ preset: "csv", header: [ 'epid','alias','active' ] });
		csv.pipe(out);

		const out_all = fs.createWriteStream(path.resolve(__dirname,"../data/meps.all.csv"));
		const csv_all = wsv({ preset: "csv", header: [ 'epid','firstname','lastname','active','start','start9','end','birthdate','country','gender','eugroup','party','email','twitter','term','start8' ] });
		csv_all.pipe(out_all);
		
		fs.createReadStream(src).pipe(jsonstream.parse('.*')).pipe(new stream.Transform({
			objectMode: true,
			transform: function(r, encoding, done) {

				// very fancy spinner
				total++;
				if (process.stdout.isTTY) process.stdout.write("[aliases] "+spinner[total%spinner.length]+"\r");

				// check if UserID is known — disabled because filter returned always true in original code
				// if (!mepids.includes(r.UserID)) return done();
			
				// check if user is active — disabled because filter returned always true in original code
				// if (!r.active) return done();

				// check for Constituencies
				if (!r.Constituencies) return console.log("[aliases] no Constituencies for id '%d'", r.UserID), done();

				// prepare constituencies
				const constituencies = r.Constituencies.filter(function(r){
					return !!r;
				}).sort(function(a,b){
					return a.end.localeCompare(b.end);
				}).map(function(c){
					return {
						...c,
						start: c.start.substr(0,10),
						end: c.end.substr(0,10),
					}
				});

				// find latest constituency
				const constituency = constituencies[constituencies.length-1];

				// assemble data
				const data = {
					birthdate: r.Birth ? r.Birth.date.substr(0,10) : null,
					gender: r.Gender || gender[r.UserID] || "",
					active: r.active,
					aliases: r.Name.aliases,
					firstname: r.Name.sur,
					lastname: r.Name.family,
					epid: r.UserID,
					
					// eugroup: sort r.Groups by "end", then get groupid of the last group (with highest end)
					eugroup: ((r.Groups||[]).sort(function(a,b){
						return a.end.localeCompare(b.end);
					}).map(function(r){
						return r.groupid;
					}).pop() || ""),
					
					// earliest date for costituency with term 8 and 9
					start8: ((constituencies.find(function(c){
						return c.term === 8;
					})||{}).start || null),
					start9: ((constituencies.find(function(c){
						return c.term === 9;
					})||{}).start || null),

					// latest constituency
					start: constituencies[0].start,
					end: (constituency.end.substr(0,4)==="9999") ? "" : constituency.end,
					party: constituency.party,
					country: countries[constituency.country],
					term: constituency.term,
					
					// extract twitter handle from url
					twitter: ((r.Twitter && r.Twitter[0]) ? r.Twitter[0].replace(/^(https?:\/\/)?((mobile\.|www\.|www-)?twitter\.com\/)?(@|%40)?([A-Za-z0-9_]+)([\/\?]+.*)?/,'$5') : "").toLowerCase(),

					// first email
					email: ((Array.isArray(r.Mail) ? r.Mail[0] : r.Mail) || "").toLowerCase(),
					
				};
				
				// check country
				if (!data.country) console.log("[aliases] missing country "+d.Constituencies[0]);
						
				// count
				processed++;
						
				this.emit("data",data);

				done();
			},
		})).on("data", function(r){

			// write to destinations

			r.aliases.forEach(function(alias){
				if (alias === alias.toLowerCase()) csv.write({
					...r,
					alias: alias,
				});
			});

			csv_all.write(r);
			
		}).on("end", function(){
			console.log("[aliases] done");

			// close destinations
			csv.end(function(){
				csv_all.end(function(){
					console.log("[aliases] imported %d records, %d records processed", processed, total);
					next();
				});
			});

		});
	});

	// run queue
	q.run(function(){
		fn(null, processed);
	});

};

if (require.main === module) main();
