"use strict";

const fs = require("fs");
const path = require("path");
const quu = require("quu");
const fetch = require("node-fetch");
const xattr = require("xattr-async");

const download = module.exports = function download(src, fn){
	
	// recurse on array
	if (Array.isArray(src)) {
		const q = quu(src.length,true);
		src.forEach(function(s){
			q.push(function(next){
				download(s, next);
			});
		});
		q.run(function(errs){
			if (errs && errs.length > 0) errs.forEach(function(err){
				console.log("[download] error: %s", err);
			});
			return fn();
		});
		return;
	};
	
	// download resource
	fs.mkdir(path.dirname(src.file), { recursive: true }, function(err){
		if (err) return fn(err);
		xattr.get(src.file, "etag", function(err, etag){ // get previous etag from xattr
			const headers = {};
			if (!err && etag) headers["If-None-Match"] = etag;
			fs.stat(src.file, function(err, stat){ // get stat
				if (!err) headers["If-Modified-Since"] = stat.mtime.toUTCString();
				return fetch(src.url, { headers: headers, redirect: 'follow', follow: 5 }).then(function(res){
					if (res.status === 304) return console.log("[download] '%s' not modified", src.url), fn(null);
					if (res.status !== 200) return console.log("[download] '%s' status code %d", src.url, res.status), fn(null);
					const et = res.headers.get("ETag");
					const lm = res.headers.get("Last-Modified");
					if (etag && et && etag === et) return console.log("[download] '%s' not modified", src.url), fn(null);
					if (stat && lm && stat.mtime.valueOf() > new Date(lm).valueOf()) return console.log("[download] '%s' not modified", src.url), fn(null);
					res.body.pipe(fs.createWriteStream(src.file).on("error", fn).on("finish", function(){
						if (!et) return console.log("[download] '%s' complete", src.url), fn(null);
						xattr.set(src.file, "etag", et, function(err){ // save etag to xattr
							return console.log("[download] '%s' complete", src.url), fn(null);
						});
					}));
				}).catch(err, fn);
			});
		});
	});

};
