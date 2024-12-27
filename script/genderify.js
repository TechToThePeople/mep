const map = require ('../src/js/gender.js');
const xsv = require("xsv");
const fs = require("fs");
const path = require("path");
const wsv = require("wsv");
const { Transform } = require('stream');

const gender = (name) => {
  return map.get(name.trim().replace(" ", "-").toUpperCase());
};

const transformStream = new Transform({
objectMode: true,
  transform(chunk, encoding, callback) {
console.log(chunk);
    callback(null, chunk);
  }
});

			// write csv
		const dest = path.resolve(__dirname,"../data/static/meps.nogender.csv");
			const out = fs.createWriteStream(dest);
			out.on("close", () => {console.log("written")});

			const csv = wsv("csv");
//			csv.pipe(out);
		fs.createReadStream(path.resolve(__dirname,"../data/meps.new.nogender.csv")).pipe(xsv({ sep: "," }).on("data", function(r){
console.log(r); 
			r.gender = gender (r.first_name);
		}).on("end", function(){
			console.log("[aliases] gender loaded");
		}))
.pipe (transformStream)
.pipe(csv)
.pipe (out);

;
//console.log(gender('xavier'));
