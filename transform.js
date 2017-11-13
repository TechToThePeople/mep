'use strict';

const fs = require('fs');
const util = require('util');
const path = require('path');
const s = require("stream");
const through2 = require('through2')

const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

function f(assembler) {
  if (assembler.stack.length == 2 && assembler.key === null) {
    if (assembler.current.hasOwnProperty("active")) {
      return assembler.current.active;
    }
  }
  // return undefined to indicate our uncertainty at this moment 
}



var total = 0;
var committees = {};
var groups = {};
var head =['epid','country','first_name','last_name','email','birthdate','gender','eugroup','party','phone','building','office','committee','substitute','delegation', 'twitter','tttpid','since'];

var stream = StreamFilteredArray.make({
  objectFilter: f
});
//var transform = s.Transform;

var abbr= {"Committee of Inquiry to investigate alleged contraventions and maladministration in the application of Union law in relation to money laundering, tax avoidance and tax evasion":"PANA"};

function transform(d) {
//epid,country,first_name,last_name,email,birthdate,gender,eugroup,party,phone,building,office,committee,substitute,delegation,twitter,tttpid,since
  function activeOnly(attr) {
    var r = [];
    if (!d[attr]) return;
    d[attr].forEach(function(item) {
      if (item.end !== '9999-12-31T00:00:00') return;
      delete item.end;
      item.start = item.start.replace("T00:00:00", "");
      if (item.start < d.since) d.since=item.start;
      if (item.abbr == null) {
        delete item.abbr;
	item.name = abbr[item.Organization];
        delete item.Organization;
      } else {
	item.name=item.abbr;
        delete item.abbr;
        delete item.Organization;
      }
      if (item.committee_id) delete item.committee_id;
      r.push(item);
    });
	  delete d[attr];
    d[attr.toLowerCase()] = r;
  }

  d.since="9999-99-99";
  delete d.changes;
  delete d.assistants;
  delete d._id;
  delete d.meta.url;
  d.first_name=d.Name.sur;
  d.last_name=d.Name.family;
  d.epid=d.UserID;
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

  if (d.Birth) d.Birth.date = d.Birth.date.replace("T00:00:00","");
  delete d.Delegations;
  //activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
  if (Array.isArray(d.groups))
    delete d.groups[0].Organization;
  activeOnly("Staff");
  return d;
}

var flatten= function (d){

//epid,country,first_name,last_name,email,birthdate,gender,eugroup,party,phone,building,office,committee,substitute,delegation,twitter,tttpid,since
  var roles = function (d,role) {
    var r=[];
    if (!d) return;
    d.forEach(function(d) {
      if (d.role == role) r.push(d.name);
    });
    return r.join("|");
  };
  var e=[
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
roles(d.committees,"Member"),
	  roles(d.committees,"Substitute"),
	  roles(d.delegations,"Member"),
	  d.Twitter,
	  "tttp_"+d.epid,
	  d.since

  ];
  return e;
}


var csv=through2({
  objectMode: true
}, function(chunk, enc, callback) {
  process.stdout.write(".");
  total++;
  if (total > 1)
    this.push(",\n");
  var d=flatten(transform(chunk.value));
  this.push(d.join(","));
  callback();
});

csv.on('end', () => {
  console.log("done" + total);
});

var simp = through2({
  objectMode: true
}, function(chunk, enc, callback) {
  process.stdout.write(".");
  total++;
  if (total > 1)
    this.push(",\n");
  this.push(JSON.stringify(transform(chunk.value))) //change keys and flatten the structure

  callback();
});

simp.on('end', () => {
  console.log("done" + total);
});

stream.output.on("end", function() {
  simp.push("]");
  simp.end();
});


let fname = path.join(__dirname, 'data/ep_meps_current.json');
fs.createReadStream(fname).pipe(stream.input)
//stream.output.pipe(simp);
stream.output.pipe(csv);
var writer = fs.createWriteStream(path.join(__dirname, 'data/meps.json'));
var csv = fs.createWriteStream(path.join(__dirname, 'data/meps.tmp'));
//simp.pipe(process.stdout);
simp.push("[");
simp.pipe(writer);
