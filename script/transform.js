"use strict";

const fs = require("fs");
const path = require("path");
const stream = require("stream");

const jsonstream = require("JSONStream");
const quu = require("quu");
const xsv = require("xsv");
//const wsv = require("wsv");
const fastcsv = require ('@fast-csv/format');
const dxid = require ('dxid');

// file paths
const src = path.resolve(__dirname,"../data/mirror/ep_meps_current.json");
const dest_meps_csv = path.resolve(__dirname,"../data/meps.csv");
const dest_meps_json = path.resolve(__dirname,"../data/meps.json");
const dest_abbreviations = path.resolve(__dirname,"../data/abbreviations.json");
const dest_twitter_dupes = path.resolve(__dirname,"../data/twitter_errors.csv");

// data and overrides
const mepid = require("../data/mepid.json");
const mepids = mepid.map(function(r){ return r.id }); // ids only for quicker lookup

const inout = require("../data/inout.json");

const country2iso= require('../data/static/country2iso.json');

const committees = Object.entries(require("../data/committees.json")).sort(function(a,b){
	return a[1].length-b[1].length; // order by length to match agains shorter strings first
}); 
const committee_ids = committees.map(function(v){ return v[0]; }).sort();

const delegations = Object.entries({ // prepare as array of key-value-pairs
	...require("../data/delegations.json"),
	"DLAT": "Euro-Latin American Parliamentary Assembly",
	"DCAS": "EU-Kazakhstan",
	"ASEAN": "ASEAN",
	"DEEA": "Switzerland",
	"DSEE": "Bosnia",
	"DANZ": "Australia",
	"D-MZ": "Macedonia",
	"DSCA": "Armenia",
	//I know, it's not a delegation, but... ,)
	"CPCO": "Committee Chairs",
	"CPDO": "Delegation Chairs",
	"BURO": "Parliament's Bureau",
	"BCPR": "Conference of Presidents",
	"PE": "European Parliament",
	"QUE": "Quaestors",
}).sort(function(a,b){
	return (a[1].length-b[1].length); // order by length to match agains shorter strings first
});

const eugroups = {
	"ECR": "ECR",
	"Group of the European United Left - Nordic Green Left": "GUE/NGL",
	"The Left group in the European Parliament - GUE/NGL": "The Left",
	"ID": "ID",
	"NA": "NA",
	"PPE": "EPP",
	"RE": "Renew",
	"S&D": "S&D",
	"Verts/ALE": "Greens/EFA",
	"GUE/NGL": "GUE/NGL",
};

const abbr = {
	"Subcommittee on Security and Defence": "SEDE",
	"Committee of Inquiry on the Protection of Animals during Transport": "ANIT",
	"Special Committee on Terrorism": "TERR",
	"Special committee on financial crimes, tax evasion and tax avoidance": "TAX3",
	"Special Committee on the Union’s authorisation procedure for pesticides": "PEST",
	"Committee of Inquiry to investigate alleged contraventions and maladministration in the application of Union law in relation to money laundering, tax avoidance and tax evasion": "PANA",
	"Special Committee on Artificial Intelligence in a Digital Age": "AIDA",
	"Special Committee on Beating Cancer": "BECA",
	"Subcommittee on Tax Matters": "FISC",
	"Special Committee on Foreign Interference in all Democratic Processes in the European Union, including Disinformation": "INGE",
	"Special Committee on foreign interference in all democratic processes in the European Union, including disinformation (INGE 2)": "ING2",
	"Committee of Inquiry to investigate the use of Pegasus and equivalent surveillance spyware": "PEGA",
};

// spinner animation
const spinner = "▁▂▃▄▅▆▇█▇▆▅▄▃▂".split("");

const main = module.exports = async function main(fn) {
	if (typeof fn !== "function") fn = function(err){ if (err) throw err; }; // callback substitute
	
	// queue
	const q = quu(1,true);

	// counters
	let processed = 0;
	let total = 0;

	// output
	const abbreviations = {}; // for collection
	const result = [];
	
	// preload data
	const gender = {};
	const twitter = {};
	const twitterError = {};

	// load gender overrides
	q.push(function(next){
		fs.createReadStream(path.resolve(__dirname,"../data/static/meps.nogender.csv")).pipe(xsv({ sep: "," }).on("data", function(r){
			gender[r.epid] = r.gender;
		}).on("end", function(){
			console.log("[transform] gender loaded");
			next();
		}));
	});

  const twitterQA = (id,screenname,source) => {
     if (screenname && twitter[id] && twitter[id].toLowerCase() !== screenname.toLowerCase()) {
       if (!source) {
         console.log("mismatch on twitter accounts for ", id, twitter[id], screenname.toLowerCase());
process.exit(1);
       }
      console.log("["+source+"] mismatch on twitter accounts for ", id, twitter[id], screenname.toLowerCase());
       if (twitterError[id])
         twitterError[id].twitter = twitterError[id].twitter.concat([screenname]);
       else 
         twitterError[id] = {twitter: [twitter[id],screenname]};
     }
  }
	
	// load wikidata for twitter (and gender and mastodon?)
	q.push(function(next){
    const wikidata = path.resolve(__dirname,"../data/wikidata.json");
    const meps = JSON.parse(fs.readFileSync(wikidata));
    meps.forEach ( d => {
//  'Mastodon address': 'violavoncramon@respublicae.eu',
//  'languages spoken, written or signed': 'German',
//  'official website': 'https://violavoncramon.de/',
//  'abgeordnetenwatch.de politician ID': '120712',
//  image: 'http://commons.wikimedia.org/wiki/Special:FilePath/Dimitris%20Rallis%2C%20Viola%20von%20Cramon%20%28cropped%29.jpg',
         twitterQA(d['MEP directory ID'],d['Twitter username'],'wikipedia');
      if (Array.isArray(d['Twitter username'])) {
        twitterError[d['MEP directory ID']] = {name:d['given name'] || d['family name'],country:d['country of citizenship'],twitter:d['Twitter username']};
        return;
      }
      twitter[d['MEP directory ID']] = d['Twitter username'];
//  'native language': 'German',
   });
			next();
	});

	// load extra_csv for twitter

	false && q.push(function(next){
		fs.createReadStream(path.resolve(__dirname,"../data/mirror/extra_csv.csv")).pipe(xsv({ sep: "," }).on("data", function(r){
			if (r.SCREEN_NAME[0] !== "@") return;
      twitterQA(r["EP id"],r.SCREEN_NAME.substr(1),"extra_csv");
			twitter[r["EP id"]] = r.SCREEN_NAME.substr(1).toLowerCase();
		}).on("end", function(){
			console.log("[transform] extra_csv loaded");
			next();
		}));
	});
	
	// load epnews for twitter accounts
	q.push(function(next){
		require("../data/mirror/epnewshub.json").data.items.forEach(function(r){
			if (!r.codictId) return;
			if (r.socialNetworks) r.socialNetworks.forEach(function(s){
				if (s.type !== "twitter") return;
				if (!s.username) return;
				if (!/^[a-zA-Z0-9_]+$/.test(s.username)) return;
         twitterQA(r.codictId.toString(),s.username.toLowerCase(), "epnewshub");
				twitter[r.codictId.toString()] = s.username.toLowerCase();
			});
		});
		console.log("[transform] epnewshub loaded");
		next();
	});
	
	// transform
	q.push(function(next){
		fs.createReadStream(src).pipe(jsonstream.parse(".*")).pipe(new stream.Transform({
			objectMode: true,
			transform: function(r, encoding, done) {

				// very fancy spinner
				total++;
				if (process.stdout.isTTY) process.stdout.write("[transform] "+spinner[total%spinner.length]+"\r");
				if (!r.active) return done();

if (r.UserID === 58766 && !r.Constituencies) {
  r.Constituencies= [
    {
      party: '',
      country: 'Romania',
      start: '2019-07-02T00:00:00',
      end: '9999-12-31T00:00:00',
      term: 9
    }
  ];
}

				if (inout.hasOwnProperty(r.UserID) && inout[r.UserID].file === "outgoing") return console.log("[transform] filter outgoing %d %o", r.UserID, r.Name.full), done();

				if (!mepids.includes(r.UserID)) return console.log("[transform] not in mepids %d %o", r.UserID, r.Name.full), done();
          if (!r.Committees)
            r.Committees=[];
          if (!r.Constituencies)
            r.Constituencies=[{start:"9999-99-99",end:"9",party:"?",country:"?"}];

				// check object
				if (!r || typeof r !== "object" || !r.hasOwnProperty("Name")) return console.log("[transform] invalid chunk"), done();
					twitterQA (             r.UserID.toString(),
					((r.Twitter && r.Twitter[0]) ? r.Twitter[0].replace(/^(https?:\/\/)?((mobile\.|www\.|www-)?twitter\.com\/)?(@|%40)?([A-Za-z0-9_]+)([\/\?]+.*)?/,"$5") : "").toLowerCase(),"europarl");

				// assemble data
				const data = {
					meta: r.meta,
//					CV: r.CV, // ← this makes the file really big. is it needed? FIXME
					Addresses: {
						Brussels: { 
							Phone: (r.Addresses?.Brussels?.Phone||""),
							Office: (r.Addresses?.Brussels?.Address?.Office||""),
						}
					},
					active: (r.active||false),
					Birth: { 
						date: (r.Birth?.date?.substr(0,10)||""),
						place: (r.Birth?.place||""),
					},
					Gender: (r.Gender || gender[r.UserID] || ""),
					first_name: r.Name.sur,
					last_name: r.Name.family,
					epid: r.UserID,
					dxid: dxid.stringify(r.UserID),
					Twitter: ((r.Twitter && r.Twitter[0]) ? r.Twitter[0].replace(/^(https?:\/\/)?((mobile\.|www\.|www-)?twitter\.com\/)?(@|%40)?([A-Za-z0-9_]+)([\/\?]+.*)?/,"$5") : "").toLowerCase() || twitter[r.UserID.toString()],
					mail: (((r.Mail && Array.isArray(r.Mail) && r.Mail.length > 0) ? r.Mail[0] : r.Mail) || "").toLowerCase() || ((!r.Name.sur.includes(" ") && !r.Name.family.includes(" ")) ? (r.Name.sur.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "." + r.Name.family.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@europarl.europa.eu") : ""), // use r.Mail[0] or r.Mail or try to costruct from first and last name

					// FIXME: data source does not have this property
					// probably looks like { "$type": { "$term": [ $activitiy, ... ] } }
					// and should be { "$type": sum($term.length, ...) }
					activities: {}, // countActivities(r.activities), 

					since: ([ // find earliest date in all the relations
						...(r.Delegations||[]),
						...(r.Staff||[]),
						...r.Committees,
						...r.Constituencies,
						...r.Groups,
					].map(function(v){
						return v.start.substr(0,10);
					}).sort(function(a,b){
						return a.localeCompare(b);
					}).shift() || "9999-99-99"),
					
					// filter and format delegations
					delegations: (r.Delegations||[]).filter(function(v){
						return (v.end[0] === "9"); // if end is ^9999 its active
					}).map(function(v){ // find abbrevation first so we can save it in an extra json
						v.name = (!v.Organization) ? null : Array.from(delegations.find(function(delegation){ return (v.Organization.indexOf(delegation[1]) >= 0); }) || [ null ]).shift();
						if (v.name === null && !v.abbr && !abbr[v.Organization] && !abbreviations.hasOwnProperty(v.Organization)) console.log("[transform] no abbreviation for delegation '%s'", v.Organization);
						abbreviations[v.Organization] = (v.abbr || v.name || abbr[v.Organization]);
						return {
							start: v.start.substr(0,10),
							role: v.role,
							name: v.abbr || v.name || abbr[v.Organization] || "??",
						};
					}),
					
					// filter and format staff
					staff: (r.Staff||[]).filter(function(v){
						return (v.end[0] === "9"); // if end is ^9999 its active
					}).map(function(v){ // find abbrevation first so we can save it in an extra json
						v.name = (!v.Organization) ? null : Array.from(delegations.find(function(delegation){ return (v.Organization.indexOf(delegation[1]) >= 0); }) || [ null ]).shift();
						if (v.name === null && !v.abbr && !abbr[v.Organization] && !abbreviations.hasOwnProperty(v.Organization)) console.log("[transform] no abbreviation for delegation '%s'", v.Organization);
						abbreviations[v.Organization] = v.name;
						return {
							start: v.start.substr(0,10),
							role: v.role,
							name: v.abbr || v.name || abbr[v.Organization] || "??",
						};
					}),
					
					// filter and format committees
					committees: r.Committees.filter(function(v){
						return (v.end[0] === "9"); // if end is ^9999 its active
					}).map(function(v){ // find abbrevation first so we can save it in an extra json
						v.name = (!v.Organization) ? null : Array.from(committees.find(function(committee){ return (v.Organization.indexOf(committee[1]) >= 0); }) || [ null ]).shift();
						if (v.name === null && !v.abbr && !abbr[v.Organization] && !abbreviations.hasOwnProperty(v.Organization)) console.log("[transform] no abbreviation for committee '%s'", v.Organization);
						abbreviations[v.Organization] = (v.abbr || v.name || abbr[v.Organization]);
						return {
							start: v.start.substr(0,10),
							role: v.role,
							name: v.abbr || v.name || abbr[v.Organization] || "??",
						};
					}),
					
					// filter and format constituency
					constituency: r.Constituencies.filter(function(v){
						return (v.end[0] === "9"); // if end is ^9999 its active
					}).map(function(v){
						if (!country2iso.hasOwnProperty(v.country)) console.log("[transform] missing country: '%s'", v.country);
						return {
							start: v.start.substr(0,10),
							party: v.party,
							country: country2iso[v.country] || v.country,
							term: v.term,
						};
					}).shift(),
					
					// filter and format eugroup
					eugroup: r.Groups.filter(function(v){
						return (v.end[0] === "9"); // if end is ^9999 its active
					}).map(function(v){
						if (!eugroups.hasOwnProperty(v.groupid)) console.log("[transform] missing group: '%s'", v.groupid);
						return eugroups[v.groupid] || /*v.groupid*/ "?";
					}).shift(), // first item
				};
			
        if (data.constituency === undefined) {
console.log("missing constituency", data); 
          data.constituency = {country:"??", party:"??"};
        }
				// count
				processed++;
						
				this.emit("data", data);

				done();
			},
		})).on("data", function(r){
			result.push(r);
		}).on("end", function(){
			console.log("[transform] got %d records", result.length);
			next();
		});
	});

	// save csv
	q.push(function(next){

		// precalculate default committees out of loop
		const committees_default = committee_ids.reduce(function(d,c){
			return d[c]="",d;
		},{});

		// set up csv writer
		const dest = fs.createWriteStream(dest_meps_csv);
		const csv = fastcsv.format({ headers: ["dxid", "country", "first_name", "last_name", "email", "birthdate", "gender", "eugroup", "party", "phone", "office", "committee", "substitute", "delegation", "twitter", "epid", "since"].concat(committee_ids) , writeHeaders: true });

		csv.pipe(dest);
		dest.on("close", function(){
			return console.log("[transform] saved meps.csv"), next();
		});
		// gilter & flatten objects and write to csv
		result.filter(function(r){
      if (typeof r?.constituency !== 'object') {
        console.warn("missing constituency",r.first_name,r.last_name);
        return false;
      }
      return true;
		}).sort(function(a,b){ return b.epid - a.epid; }).map(function(r){
			return {
			  dxid: r.dxid,
//        country: r.country,
        first_name: r.first_name,
        last_name: r.last_name,
        eugroup: r.eugroup,
        since: r.since,
	
				email: r.mail,
				twitter: r.Twitter,
			  epid: r.epid,
				gender: r.Gender,
				
				country: r.constituency.country,
				birthdate: r.Birth.date,
				party: r.constituency.party,
				phone: r.Addresses.Brussels.Phone,
				office: r.Addresses.Brussels.Office,
				
				committee: r.committees.filter(function(c){ return [ "Chair", "Vice-Chair", "Member" ].includes(c.role) }).map(function(c){ return c.name }).join("|"),
				substitute: r.committees.filter(function(c){ return (c.role === "Substitute") }).map(function(c){ return c.name }).join("|"),
				delegation: r.delegations.filter(function(c){ return [ "Chair", "Vice-Chair", "Member" ].includes(c.role) }).map(function(c){ return c.name }).join("|"),
				
				...committees_default,
				...r.committees.reduce(function(d,c){
					return d[c.name] = c.role[0],d;
				},{}),
				
			};
			
		}).forEach(function(r){
			csv.write(r);
		});

		// finish csv writer
		csv.end();

	});
	
	// save twitter duplicates csv
	q.push(function(next){
next();

		// set up csv writer
		const dest = fs.createWriteStream(dest_twitter_dupes);
		const csv = fastcsv.format({ headers: ["epid", "name","correct","twitter1","twitter2"]});
		csv.pipe(dest);
		dest.on("close", function(){
			return console.log("[transform] saved twitter dupes.csv"), next();
		});

		// gilter & flatten objects and write to csv
		Object.keys(twitterError).forEach ( d => {
      d = parseInt(d,10);
      const mep=result.find (m => {
        return m.epid === d;
     });
     if (!mep)  {
console.log("missing",d);
      }
      const t = {...twitterError[d],epid:d};
      t.name = mep? mep.first_name + " " + mep.last_name : t.name;
      twitterError[d].twitter.forEach ( (d,i) => {
        t["twitter"+(i+1)]=d;
        t["twitter"+(i+1)]=d;
      });
			csv.write(t);
		});
		// finish csv writer
		csv.end();

	});
	
	// save json
	q.push(function(next){
		fs.writeFile(dest_meps_json, JSON.stringify(result), function(err){
			if (err) return console.log("[transform] error saving meps.json: %s", err), next();
			return console.log("[transform] saved meps.json"), next();
		});
	});

	// save abbreviations json
	q.push(function(next){
		fs.writeFile(dest_abbreviations, JSON.stringify(Object.entries(abbreviations).reduce(function(d,v){ 
			return d[v[1]]=v[0],d; // flip key and value
		},{}),null,"\t"), function(err){
			if (err) return console.log("[transform] error saving abbreviations.json: %s", err), next();
			return console.log("[transform] saved abbreviations.json"), next();
		});
	});

	// run queue
	q.run(function(){
		console.log("[transform] done");
		fn(null, processed);
	});

};

if (require.main === module) main();
