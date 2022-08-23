const vm = require("vm");
const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname,"../data/meps_str.js");
const dest = path.resolve(__dirname,"../data/mepid.json");

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

	// load source js
	fs.readFile(src, function(err, source){
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
		const result = ctx.meps_str.filter(function(r){
			return r.country_code !== "x";
		}).map(function(r){
			return {
				id: r.id_mep,
				firstName: r.prenom,
				lastName: r.nom,
				group: r.group_code,
				country: r.country_code,
				seat: r.id_siege,
			}
		});

		// status
		console.log("[mepid] imported %d records", result.length);

		// save
		fs.writeFile(dest, JSON.stringify(result), fn);

	});

};

if (require.main === module) main();