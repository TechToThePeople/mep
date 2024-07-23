"use strict";
// to use https://www.europarl.europa.eu/erpl-public/hemicycle//str/en.json .groups
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const quu = require("quu");

const src = path.resolve(__dirname,"../data/mirror/eugroup.json");
const dest = path.resolve(__dirname,"../data/eugroups.json"); // thats confusing
const dest_img = path.resolve(__dirname,"../img/group");

const groups = require(src).data.items;

// donwload helper
const download = function download(url, dest){
	return new Promise(function(resolve, reject){
		console.log("[eugroup] download '%s' → '%s'", url, path.basename(dest));
		fs.mkdir(path.dirname(dest), { recursive: true }, async function(err){
      try {
			const res = await fetch(url);
			res.body.pipe(fs.createWriteStream(dest).on("error", reject).on("finish", resolve));
      } catch (e) { 
 console.log("can't download",e);
       reject();
      }
		});
	});
};

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute

	const q = quu(5,true);

	const data = groups.reduce(function(g,r){

		console.log("[eugroup] group %s", r.politicalGroup.eparty);

		// make safe for use in filename
		const slug = (r.politicalGroup.eparty.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(" ","-"));

		g[r.politicalGroup.eparty] = {
			accronym: r.politicalGroup.eparty,
			name: r.fullName,
			picture: "logo-"+slug+".png",
			icon: "icon-"+slug+".png",
			url: r.profileLink
		};

		// fetch logo from data source
		q.push(async function(next){
      try {
			await download(r.pictureLink, path.resolve(dest_img, "logo-"+slug+".png"));
      } catch (e) {
 console.log("can't download",e);
      }
			next();
		});

		// fetch favicon via google api FIXME maybe this is not the best approach?
		if (!!r.profileLink && !/facebook|twitter/.test(r.profileLink)) q.push(async function(next){
      try {
			await download("https://www.google.com/s2/favicons?domain="+r.profileLink, path.resolve(dest_img, "icon-"+slug+".png"));
      } catch (e) {
			g[r.politicalGroup.eparty].icon= undefined;
 console.log("can't download",e);
      }
			next();
		});

			
		return g;
	},{});
	
	q.run(function(){
console.log(data);
		fs.writeFile(dest, JSON.stringify(data,null,"\t"), fn);
	});

};

if (require.main === module) main();
