"use strict";

const fs = require("fs");
const path = require("path");
const xsv = require("xsv");

if (!process.argv[2]) console.error("csv2json.js <meps.csv>"), process.exit(1);

let data = [];
fs.createReadStream(path.resolve(process.cwd(), process.argv[2])).pipe(xsv({ sep: "," }).on("data", function(r){
	data.push({
		epid: r.epid,
		first_name: r.first_name,
		eugroup: r.eugroup,
		last_name: r.last_name,
		Twitter: r.twitter,
		constituency:{
			party: r.party,
			country: r.country
		},
	});
}).on("end", function(){
	console.log(JSON.stringify(data,null,"\t"));
}))
