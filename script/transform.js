'use strict';
const   file = require("fs");

var finished = function(n) {
  console.log("Processed " + n)
};
var total = 0;
var committees = {};
var groups = {};
var head = ['epid', 'country', 'first_name', 'last_name', 'email', 'birthdate', 'gender', 'eugroup', 'party', 'phone', 'office', 'committee', 'substitute', 'delegation', 'twitter', 'tttpid', 'since'];

var abbreviations={};
var delegations = require('../data/delegations.json');
var country2iso= require('../data/country2iso.json');
delegations.DLAT = "Euro-Latin American Parliamentary Assembly";
delegations.DCAS = "EU-Kazakhstan";
delegations.ASEAN = "ASEAN";
delegations.DEEA = "Switzerland";
delegations.DSEE = "Bosnia";
delegations.DANZ = "Australia";
delegations["D-MZ"] = "Macedonia";
delegations.DSCA = "Armenia";
//I know, it's not a delegation, but... ;)
delegations.CPCO = "Committee Chairs";
delegations.CPDO ="Delegation Chairs";
delegations.BURO ="Parliament's Bureau";
delegations.BCPR="Conference of Presidents";
delegations.PE="European Parliament";
delegations.QUE="Quaestors";

const fs = require('fs');
const util = require('util');
const path = require('path');
const through2 = require('through2')
const JSONStream = require('JSONStream');
const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

var mepid= require('../data/mepid.json'); // direct from EP site, for QA
var epnews= require('../data/epnewshub.json'); // direct from EP site, for QA
var csvparse=require('csv-parse/lib/sync.js');
var nogender= csvparse(fs.readFileSync('data/meps.nogender.csv'),{columns:true,auto_parse:true}); // fixing manually the missing genders

function indexepnews (epnews){
  var meps={};
  epnews.items.map(function(d){
    var sm={}
    if (d.socialMediaSources.twitter){
      sm.twitter=d.socialMediaSources.twitter.feedUrl.replace(/.*\/(.*)\//g,"");
    }
      // todo: regex ".*twitter.com/"
    if (d.socialMediaSources.facebook)
      sm.facebook=d.socialMediaSources.facebook.feedUrl;
    if (sm.twitter || sm.facebook)
      meps[d.codictId]=sm;
  });
  return meps;
}

function isActive (id) {return mepid.find(o => o.id === id);}

function f(assembler) {
  if (assembler.stack.length == 2 && assembler.key === null) {
    if (assembler.current.hasOwnProperty("UserID")) {

      const q=isActive(assembler.current.UserID);
      if (!q) {
        return false;
      }
    }
    if (assembler.current.hasOwnProperty("active")) {
      return assembler.current.active;
    }
  }
  // return undefined to indicate our uncertainty at this moment 
}

function getDelegation(s) {
  if (!s) return null;
  for (const key of Object.keys(delegations)) {
    if (s.indexOf(delegations[key]) !== -1) {
      return key;
    }
  }
  return null;
}


var stream = StreamFilteredArray.make({
  objectFilter: f
});
//var transform = s.Transform;

var abbr = {
  "Subcommittee on Security and Defence": "SEDE",
  "Special Committee on Terrorism": "TERR",
  "Special committee on financial crimes, tax evasion and tax avoidance": "TAX3",
  "Special Committee on the Union’s authorisation procedure for pesticides": "PEST",
  "Committee of Inquiry to investigate alleged contraventions and maladministration in the application of Union law in relation to money laundering, tax avoidance and tax evasion": "PANA"
};

function transform(d) {
  function fixGender (id) {
    var g=nogender.find(o => o.epid === id);
    return g? g.gender: '';
  }
  function activeOnly(attr,custom={}) {
    let defaults = {
      single : false,name:attr.toLowerCase(),long:"Organization", abbr:"abbr"
    };
    let options = Object.assign({}, defaults, custom);
    if (typeof options.abbr == "string") {
      var k=options.abbr;
      options.abbr = function(d){
        return d.abbr || d[k] || abbr[d.Organization] || "??";
      };
    } else {
      if (options.abbr) {
        var f=options.abbr;
        options.abbr = function (i){return f(i.Organization);};
      }
    }

    var r = [];
    if (!d[attr]) return;
    d[attr].forEach(function(item) {
      if (item.start < d.since) d.since = item.start;
      if (item.end !== '9999-12-31T00:00:00') return;
      if (options.abbr) {
        abbreviations[options.abbr(item)]= item[options.long];
        if (options.abbr(item) =="??")
          console.log(item);
        var i = {
          start:item.start.replace("T00:00:00", ""),
          role:item.role,
          name:options.abbr(item)
        }
        r.push(i);
        return;
      }
      delete item.end;
      r.push(item);
      return;
    });
    delete d[attr];
    if (options.single && r.length >0) {
      d[options.name] = r[0];
      return;
    } 
    d[options.name] = r;
  }

  function countActivities(a) {
    //console.log(util.inspect(d.activities, {showHidden: false, depth: null}))
    var r={}
    for (var type in a) { //REPORT-SHADOW, REPORT...
      var i=0;
      r[type]=0;
      for (var term in a[type]) { //
        r[type] +=a[type][term].length;
      }
    }
    return r;
  }

  if (!d || !typeof d === 'object' || !d.hasOwnProperty("Name")) return {};
  d.since = "9999-99-99";
  delete d.changes;
  delete d.assistants;
  delete d._id;
  delete d.meta.url;
  d.first_name = d.Name.sur;
  d.last_name = d.Name.family;
  d.epid = d.UserID;
  if (!d.Gender) d.Gender=fixGender(d.epid);
  delete d.UserID;
  delete d.Name;
  delete d.Addresses.Postal;
  delete d.Addresses.Strasbourg;
  d.Addresses.Brussels.Office = d.Addresses.Brussels.Address.Office;
  delete d.Addresses.Brussels.Address;
  delete d.Addresses.Brussels.Fax;
  delete d.Photo; //"http://www.europarl.europa.eu/mepphoto/{{d.epid }}.jpg
  d.activities=countActivities(d.activities);
  //delete d.activities; // stuff might be to be kept there
  delete d["Declarations of Participation"];
  delete d["Financial Declarations"];

  if (Array.isArray(d.Twitter)) {
    d.Twitter = d.Twitter[0]
  };
  if (d.Twitter)
    d.Twitter=d.Twitter.replace(/.*twitter.com\//ig,"");
  if (epnews[d.epid] && epnews[d.epid].twitter) {
    d.Twitter=epnews[d.epid].twitter;
  };
  if (d.Birth) {
    d.Birth.date = d.Birth.date.replace("T00:00:00", "");
  } else {
    d.Birth = {};//{date:null,place:null};
  }
  d.mail= Array.isArray(d.Mail) ? d.Mail[0] : d.Mail;
  delete d.Mail;
  //delete d.Delegations;
  activeOnly("Delegations",{abbr:getDelegation});
  activeOnly("Committees",{abbr:"committee_id"});
  activeOnly("Constituencies",{"single":true,"name":"constituency",abbr:null});
  activeOnly("Groups",{"single":true,"name":"eugroup",abbr:"groupid"});
  d.eugroup=d.eugroup.name;
  if (Array.isArray(d.eugroup)){
    d.eugroup = d.eugroup.join("/");
  }
  activeOnly("Staff",{abbr:getDelegation});
  d.since = d.since.replace("T00:00:00", "");
  d.constituency.country = country2iso[d.constituency.country];
  if (!d.constituency.country) 
    console.log(d);
  if (d.constituency && d.constituency.start)
    d.constituency.start=d.constituency.start.replace("T00:00:00", "");
  return d;
}

var csvrow = function(d) {
  //epid,country,first_name,last_name,email,birthdate,gender,eugroup,party,phone,office,committee,substitute,delegation,twitter,tttpid,since
  var roles = function(d, roles) {
    if (!Array.isArray(roles)) roles = [roles];
    var r = [];
    if (!d) return r;
    d.forEach(function(d) {
      roles.forEach(function(role) {
        if (d.role == role) r.push(d.name);
      });
    });
    return r;
  };

  if (!typeof d === 'object' || !d.hasOwnProperty("constituency")) return {};
  var e = [
    d.epid,
    d.constituency.country,
    d.first_name,
    d.last_name,
    d.mail, //Mail[0],
    d.Birth.date,
    d.Gender,
    d.eugroup,
    d.constituency.party,
    d.Addresses.Brussels.Phone,
    d.Addresses.Brussels.Office,
    roles(d.committees, ["Chair", "Vice-Chair", "Member"]).join("|"),
    roles(d.committees, "Substitute").join("|"),
    roles(d.delegations, ["Chair", "Vice-Chair", "Member"]).join("|"),
    d.Twitter,
    "tttp_" + d.epid,
    d.since

  ];
  return e;
}


var csv = through2({
  objectMode: true
}, function(chunk, enc, callback) {
  var d = csvrow(chunk);
  this.push(d);
  callback();
});

csv.on('end', () => {});

var simp = through2({
  objectMode: true
}, function(chunk, enc, callback) {
  process.stdout.write(".");
  var d = transform(chunk.value);
  if (d) {
    total++;
    this.push(d) //change keys and flatten the structure
  }
  callback();
});

simp.on('end', () => {
  file.writeFileSync("./data/abbreviations.json", JSON.stringify(abbreviations));
  finished(total);
});

stream.output.on("end", function() {
  simp.end();
  //  csv.end();
});


function write(options = {
  from: "data/ep_meps_current.json",
  csv: "data/meps.csv",
  json: 'data/meps.json'
}, callback) {
  fs.createReadStream(options.from).pipe(stream.input)
  var writer = fs.createWriteStream(options.json);
  const csvwriter = require('csv-write-stream')({headers: head});
  csvwriter.pipe(fs.createWriteStream(options.csv));
  stream.output.pipe(simp);
  simp.pipe(csv).pipe(csvwriter).pipe(fs.createWriteStream(options.csv));
  simp.pipe(JSONStream.stringify()).pipe(writer);

  if (typeof callback == "function") {
    csvwriter.on("finish", function() {
      callback()
    });
  }
}

if (require.main === module) {
  epnews = indexepnews (epnews);
  write();
} else {
  exports.write = write;
  exports.processed = total;
}
