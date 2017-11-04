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
//epid,country,first_name,last_name,email,birthdate,gender,eugroup,party,phone,building,office,committee,substitute,delegation,twitter,tttpid,since

var stream = StreamFilteredArray.make({
  objectFilter: f
});
var transform = s.Transform;

var abbr= {"Committee of Inquiry to investigate alleged contraventions and maladministration in the application of Union law in relation to money laundering, tax avoidance and tax evasion":"LUXLEAK"};

function transform(d) {
//epid,country,first_name,last_name,email,birthdate,gender,eugroup,party,phone,building,office,committee,substitute,delegation,twitter,tttpid,since
  function activeOnly(attr) {
    var r = [];
    if (!d[attr]) return;
    d[attr].forEach(function(item) {
      if (item.end !== '9999-12-31T00:00:00') return;
      delete item.end;
      item.start = item.start.replace("T00:00:00", "");
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
    d[attr] = r;
  }
  delete d.changes;
  delete d.assistants;
  delete d._id;
  delete d.meta.url;
  delete d.Name.aliases;
  delete d.Name.familylc;
  delete d.Name.full;
  delete d.Addresses.Postal;
  delete d.Addresses.Strasbourg;
  d.Addresses.Brussels.Office = d.Addresses.Brussels.Address.Office;
  delete d.Addresses.Brussels.Address;
  delete d.Addresses.Brussels.Fax;
  delete d.Photo; //"http://www.europarl.europa.eu/mepphoto/{{d.UserID }}.jpg
  delete d.activities; // stuff might be to be kept there
  delete d["Declarations of Participation"];
  delete d["Financial Declarations"];

  if (d.Birth) d.Birth.date = d.Birth.date.replace("T00:00:00","");
  delete d.Delegations;
  //activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
  if (Array.isArray(d.Groups))
    delete d.Groups[0].Organization;
  activeOnly("Staff");
  return d;
}

function clean(d) {
  function activeOnly(attr) {
    var r = [];
    if (!d[attr]) return;
    d[attr].forEach(function(item) {
      if (item.end !== '9999-12-31T00:00:00') return;
      delete item.end;
      item.start = item.start.replace("T00:00:00", "");
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
    d[attr] = r;
  }
  delete d.changes;
  delete d.assistants;
  delete d._id;
  delete d.meta.url;
  delete d.Name.aliases;
  delete d.Name.familylc;
  delete d.Name.full;
  delete d.Addresses.Postal;
  delete d.Addresses.Strasbourg;
  d.Addresses.Brussels.Office = d.Addresses.Brussels.Address.Office;
  delete d.Addresses.Brussels.Address;
  delete d.Addresses.Brussels.Fax;
  delete d.Photo; //"http://www.europarl.europa.eu/mepphoto/{{d.UserID }}.jpg
  delete d.activities; // stuff might be to be kept there
  delete d["Declarations of Participation"];
  delete d["Financial Declarations"];

  if (d.Birth) d.Birth.date = d.Birth.date.replace("T00:00:00","");
  delete d.Delegations;
  //activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
  if (Array.isArray(d.Groups))
    delete d.Groups[0].Organization;
  activeOnly("Staff");
  return d;
}

var simp = through2({
  objectMode: true
}, function(chunk, enc, callback) {
  process.stdout.write(".");
  total++;
  if (total > 1)
    this.push(",\n");
  //this.push(JSON.stringify(clean(chunk.value))) // keeps a similar structure
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
stream.output.pipe(simp);

let fname = path.join(__dirname, 'data/ep_meps_current.json');
fs.createReadStream(fname).pipe(stream.input)
var writer = fs.createWriteStream(path.join(__dirname, 'data/meps.json'));
//var csv = fs.createWriteStream(path.join(__dirname, 'data/meps.tmp'));
//simp.pipe(process.stdout);
simp.push("[");
simp.pipe(writer);
