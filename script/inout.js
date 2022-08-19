"use strict";

const fs = require("fs");
const path = require("path");
const format = require("util").format;

const xml2js = require("xml2js");
const quu = require("quu");
const wsv = require("wsv");

const src = path.resolve(__dirname,"../data/%s.xml");
const dest = path.resolve(__dirname,"../data/inout.%s");

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
	
	const result = [];
	const q = quu(1,true); // create queue

	[ "incoming", "outgoing" ].forEach(function(f){ // queue incoming and outgoing
		q.push(function(next) {
			fs.readFile(format(src,f), function(err, data) {
				if (err) throw err;
				
				// create xml parser
				const parser = new xml2js.Parser({
					explicitArray: false,
					mergeAttrs: true,
					tagNameProcessors: [
						function(k) { return k.startsWith('mandate-') ? k.substring(8) : k }, 
					],
					valueProcessors: [
						function(v,k) { return (k === "id" || k === "leg") ? +v : v }, // ensure id and let agre integers
						function(v,k) { return (k === 'end' && (v === 'ONGOING' || v === '01/07/2019')) ? null : v }, // set end to null when ONGOING or 2019-07-01
						function(v,k) { return (k === 'start' || k === 'end') ? (!v) ? null : v.split("/").reverse().join("-") : v }, // format date for start and end
					],
				});
				
				// parse, format, add to result
				parser.parseString(data, function(err, data) {
					if (err) throw err;
					data.meps.mep.forEach(function(r){
						result.push({
							fullName: r.fullName,
							country: r.country.countryCode,
							id: r.id,
							leg: r.leg,
							start: r.start,
							end: r.end,
							file: f,
							eugroup: r.politicalGroup.bodyCode,
							party: r.nationalPoliticalGroup._,
						});
					});
				});
				
				// done
				next();
				
			});
		});
	});
	
	q.run(function(){
		
		// sanity checks
		if (!result || result.length === 0) throw new Error("invalid data: result is empty");

		// status
		console.log("[inout] imported %d records", result.length);
		
		// write json
		fs.writeFile(format(dest,"json"), JSON.stringify(result.reduce(function(c,r){ 
			return c[r.id]=r,c; // array → object, using id as key
		},{})), function(err){
			if (err) throw err;
			
			// write csv
			const out = fs.createWriteStream(format(dest,"csv"));
			out.on("end", fn);

			const csv = wsv("csv");
			csv.pipe(out);
			result.forEach(function(r){ csv.write(r); });
			csv.end();
			
		});

	});

};

if (require.main === module) main();


/* 
	notes from previous code:
	q 'select inc.id as id_incoming, out.id as id_outgoing, cast(julianday(inc.start)-julianday(out.end) as int) as days, out.country,out.eugroup,out.end,inc.start,out.fullName as name_out,inc.fullName as name_in from data/inout.csv out join data/inout.csv inc on out.file="outgoing" and inc.file="incoming" and inc.country=out.country and inc.eugroup=out.eugroup and date(out.end) <= date(inc.start) and date(out.end,"+50 days") >= date(inc.start) order by out.country,out.eugroup' -d, -H -O > data/replacement.csv
	q 'select name_out, count(*) from data/replacement.csv group by name_out having count(*) >1' -d, -H 
*/
