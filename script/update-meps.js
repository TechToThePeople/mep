"use strict";

const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js").parseString;
const vm = require("vm");
const quu = require("quu");

const countries = require("../data/static/country2iso.json");
const groups = Object.values(require("../data/eugroups.json")).reduce(function(g,r){
	return g[r.name]=r.accronym,g;
},{});
const out = Object.keys(Object.values(require("../data/inout.json")).filter(function(r){
	return r.file === "outgoing";
}).reduce(function(g,r){
	return g[r.id.toString()]=r,g;
},{}));

const src_xml = path.resolve(__dirname,"../data/mirror/mepid.xml");
const dest = path.resolve(__dirname,"../data/mepid.json");

// the full-list endpoint now serves JSON, sometimes still XML
const parse_mepid = function(data, cb) {
	const txt = data.toString();
	if (txt.trimStart().charAt(0) === "<") return xml2js(data, cb);
	let j;
	try {
		j = JSON.parse(txt);
	} catch (err) {
		return cb(err);
	}
	cb(null, { meps: { mep: j.list.map(function(r){
		return {
			id: [r.persId],
			fullName: [r.fullName],
			country: [r.countryLabel],
			politicalGroup: [r.politicalGroupLabel],
		};
	}) } });
};

const import_xml = function(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
		
	fs.readFile(src_xml, function(err, data){
		if (err) return fn(err);

		parse_mepid(data, function (err, data) {
			if (err) return fn(err);

			data = data.meps.mep.map(function(r){

				const name = r.fullName[0].split(" ").reduce(function(n,f){
					n[(f.toUpperCase() === f) ? "lastName" : "firstName"].push(f);
					return n;
				},{
					firstName: [],
					lastName: [],
				});

				if (!Object.hasOwn(groups, r.politicalGroup[0])) {
console.log(r.politicalGroup);
          throw new Error("Unknown Group: "+r.politicalGroup[0]);
        }
				if (!Object.hasOwn(countries, r.country[0])) throw new Error("Unknown Country: "+r.country[0]);

				return {
					id: r.id[0].toString(),
					firstName: name.firstName.join(" "),
					lastName: name.lastName.join(" "),
					group: groups[r.politicalGroup[0]],
					country: countries[r.country[0]],
				};
			}).filter(function(r){
				return !out.includes(r.id);
			});
			
			// status
			console.log("[update-meps] imported %d records from mepid.xml", data.length);
			
			// deliver
			return fn(null, data);

		});

		
	});
	
};

const import_js = async function(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

	// load source js
	fs.readFile(src_js, function(err, source){
		if (err) return fn(err);

		// execute js in vm
		const ctx = {};
		try {
			new vm.Script(source).runInNewContext(ctx);
		} catch (err) {
			return fn(err);
		}

		// check data
		if (!ctx.meps_str) throw new Error("invalid data: meps_str not set");
		if (!Array.isArray(ctx.meps_str)) throw new Error("invalid data: meps_str is not an Array");
		if (ctx.meps_str.length === 0) throw new Error("invalid data: meps_str is empty");
		
		// format
		const data = ctx.meps_str.filter(function(r){
			return r.country_code !== "x";
		}).map(function(r){
			return {
				id: r.id_mep.toString(),
				firstName: r.prenom,
				lastName: r.nom.toUpperCase(),
				group: r.group_code,
				country: r.country_code.toLowerCase(),
				seat: r.id_siege,
			}
		}).filter(function(r){
			return !out.includes(r.id);
		});

		// status
		console.log("[update-meps] imported %d records from meps_str.js", data.length);

		// deliver
		return fn(null, data);

	});

};

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
		
	const result = {};
	
	const q = quu(1,true);
		
	q.push(function(next){
		import_xml(function(err, data){
			if (err) throw err;
			data.forEach(function(r){
				result[r.id] = {
					...(result[r.id]||{}),
					...r,
					seat: null,
				};
			});
			next();
		});
	});

		
	q.run(function(){
		// status
		console.log("[update-meps] merged into %d records", Object.keys(result).length);
		
		// save
		fs.writeFile(dest, JSON.stringify(Object.values(result).map(function(r){
			r.id = parseInt(r.id,10);
			return r;
		}).sort(function(a,b){
			return a.id - b.id;
		}),null,"\t"), fn);
		
	});

};

main.parse_mepid = parse_mepid;

if (require.main === module) main();
