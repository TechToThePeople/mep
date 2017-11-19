'use strict';

var finished = function(n) {
  console.log("Processed " + n)
};
var total = 0;
var committees = {};
var groups = {};
var head = ['epid', 'country', 'first_name', 'last_name', 'email', 'birthdate', 'gender', 'eugroup', 'party', 'phone', 'office', 'committee', 'substitute', 'delegation', 'twitter', 'tttpid', 'since'];

var delegations = require('../data/delegations.json');
delegations.DLAT = "Euro-Latin American Parliamentary Assembly";
delegations.DCAS = "EU-Kazakhstan";
delegations.ASEAN = "ASEAN";
delegations.DEEA = "Switzerland";
delegations.DSEE = "Bosnia";
delegations.DANZ = "Australia";
delegations["D-MZ"] = "Macedonia";
delegations.DSCA = "Armenia";

const fs = require('fs');
const util = require('util');
const path = require('path');
const through2 = require('through2')
const JSONStream = require('JSONStream');
const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

var mepid= require('../data/mepid.json'); // direct from EP site, for QA
var csvparse=require('csv-parse/lib/sync.js');
var nogender= csvparse(fs.readFileSync('data/meps.nogender.csv'),{columns:true,auto_parse:true}); // fixing manually the missing genders

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
  "Committee of Inquiry to investigate alleged contraventions and maladministration in the application of Union law in relation to money laundering, tax avoidance and tax evasion": "PANA"
};

function transform(d) {
  function fixGender (id) {
    var g=nogender.find(o => o.epid === id);
    return g? g.gender: '';
  }
  function activeOnly(attr) {
    var r = [];
    if (!d[attr]) return;
    d[attr].forEach(function(item) {
      if (item.start < d.since) d.since = item.start;
      if (item.end !== '9999-12-31T00:00:00') return;
      delete item.end;
      item.start = item.start.replace("T00:00:00", "");
      if (item.abbr == null) {
        delete item.abbr;
        item.name = abbr[item.Organization];
        if (!item.name) {
          item.name = getDelegation(item.Organization) || item.Organization;
        }
        delete item.Organization;
      } else {
        item.name = item.abbr;
        delete item.abbr;
        delete item.Organization;
      }
      if (item.committee_id) delete item.committee_id;
      r.push(item);
    });
    delete d[attr];
    d[attr.toLowerCase()] = r;
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
  delete d.activities; // stuff might be to be kept there
  delete d["Declarations of Participation"];
  delete d["Financial Declarations"];

  if (Array.isArray(d.Twitter)) {
    d.Twitter = d.Twitter[0]
  };
  if (d.Birth) {
    d.Birth.date = d.Birth.date.replace("T00:00:00", "");
  } else {
    d.Birth = {};
  }
  //delete d.Delegations;
  activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
  if (Array.isArray(d.groups))
    delete d.groups[0].Organization;
  activeOnly("Staff");
  d.since = d.since.replace("T00:00:00", "");
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

  if (!typeof d === 'object' || !d.hasOwnProperty("constituencies")) return {};
  var e = [
    d.epid,
    d.constituencies[0].country,
    d.first_name,
    d.last_name,
    d.Mail[0],
    d.Birth.date,
    d.Gender,
    d.groups[0].groupid,
    d.constituencies[0].party,
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
  finished(total);
});

stream.output.on("end", function() {
  simp.end();
  //  csv.end();
});


function write(options = {
  from: "data/ep_meps_current.json",
  csv: "data/meps.tmp",
  json: 'data/meps.json'
}, callback) {
  fs.createReadStream(options.from).pipe(stream.input)
  var writer = fs.createWriteStream(options.json);
  const csvwriter = require('csv-write-stream')({headers: head});
//  csvwriter.pipe(fs.createWriteStream(options.csv));
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
  write();
} else {
  exports.write = write;
  exports.processed = total;
}
