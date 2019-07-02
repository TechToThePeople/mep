'use strict';
const   file = require("fs");
const countries = JSON.parse(file.readFileSync("./data/country2iso.json"));
var finished = function(n) {
  console.log("Processed " + n)
};
var total = 0;
const head = ['epid', 'alias','active'];
const headall = ['epid','firstname','lastname','active','start','start9','end','birthdate','country','gender','eugroup','party','email','twitter','term'];
const fs = require('fs');
const util = require('util');
const path = require('path');
const through2 = require('through2')
const JSONStream = require('JSONStream');
const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

var mepid= require('../data/mepid.json'); // direct from EP site, for QA, needs to run scripts/st_mep.json
var csvparse=require('csv-parse/lib/sync.js');
var nogender= csvparse(fs.readFileSync('data/meps.nogender.csv'),{columns:true,auto_parse:true});
  function fixGender (id) {
    var g=nogender.find(o => o.epid === id);
    return g? g.gender: '';
  }


function isActive (id) {return mepid.find(o => o.id === id);}

function f(assembler) {
  return true;
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

function transform(d) {
  if (!d.Constituencies) {
    console.log(d);
    return;
  }
  //we start with the first constituency, it will be adjusted later if needed
  var t={start:Date(),end:d.Constituencies[0].end};
  var getGroup = function (){
    var abbr=null, end='';
    if (!d.Groups) return '';
    d.Groups.forEach(g => {
      if (g.end > end) {
        end=g.end;
        abbr=g.groupid;
      }
    });
    return abbr;
  }

  // set start, to, party and country based on the Constituencies (the latest one)
  var constituencing= function(){
    var last = 0;
    d.Constituencies.forEach(function(c,i){
      if (!c) return;// deal with incomplete
      if (c.term==9) {
        if (!t.start9 || c.start < t.start9)
          t.start9 = c.start.replace("T00:00:00", "");
      }
      if (c.start < t.start) t.start = c.start;
      if (c.end > t.end) {
        t.end = c.end;
        last = i;
      }
    });
    t.start=t.start.replace("T00:00:00", "");
    if (!t.end) {
      console.log(t);
      process.exit(1);
    }
    //t.end= d.active ? "" : t.end.replace("T00:00:00", "");
    t.end= t.end == "9999-12-31T00:00:00"? "": t.end.replace("T00:00:00", "");
    t.party=d.Constituencies[last].party;
    t.country=countries[d.Constituencies[last].country];
    t.term=d.Constituencies[last].term;
  }

  t.birthdate=d.Birth ? d.Birth.date.replace("T00:00:00", "") : null;
  if (!d.Gender) d.Gender=fixGender(d.UserID);

  t.gender=d.Gender;
  t.active=d.active;
  t.aliases=d.Name.aliases;
  t.firstname=d.Name.sur;
  t.lastname=d.Name.family;
  t.epid=d.UserID;
  t.eugroup= getGroup(); //d.Groups ? d.Groups[0].groupid : "";
  if (Array.isArray(t.eugroup)){
    t.eugroup = t.eugroup.join("/");
  }
  constituencing();
  t.twitter= "";
  if (d.Twitter && d.Twitter[0].indexOf(".com/") !== -1) {
    t.twitter=d.Twitter[0].substring(d.Twitter[0].indexOf(".com/")+5);
    var param=t.twitter.indexOf("?lang=");
    if (param !== -1) t.twitter=t.twitter.substring(0,param);
  } else {
    if (d.Twitter){
      if (d.Twitter[0]){
        t.twitter=d.Twitter[0].substring(d.Twitter[0].indexOf("@")+1);
      } else {
        console.log(d.Twitter);
      }
    }
  }
  t.email= Array.isArray(d.Mail) ? d.Mail[0] : d.Mail || "";
  t.email=t.email.toLowerCase();
  t.twitter=t.twitter.toLowerCase();
  if (!t.country) {
    console.log("missing country "+d.Constituencies[0]);
  }
//  if (t.epid==97025) console.log(d);
  return t;
}

var stream = StreamFilteredArray.make({
  objectFilter: f
});

var csv = through2({
  objectMode: true
}, function(mep, enc, callback) {
  mep.aliases.forEach(function(d){
    if (d == d.toLowerCase())
      csv.push([mep.epid,d,mep.active]);
  });
  callback();
});

csv.on('end', () => {});

var csvall = through2({
  objectMode: true
}, function(mep, enc, callback) {
  csvall.push([mep.epid,mep.firstname,mep.lastname,mep.active,mep.start,mep.start9,mep.end,mep.birthdate,mep.country,mep.gender,mep.eugroup,mep.party,mep.email,mep.twitter,mep.term]);
  callback();
});

csvall.on('end', () => {});

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
  csvaliases: "data/meps-aliases.csv",
  csvall: "data/meps.all.csv",
  json: 'data/meps-aliases.json'
}, callback) {
  fs.createReadStream(options.from).pipe(stream.input)
  var writer = fs.createWriteStream(options.json);
  const csvwriter = require('csv-write-stream')({headers: head});
  const csvwriterall = require('csv-write-stream')({headers: headall});
//  csvwriter.pipe(fs.createWriteStream(options.csv));
  stream.output.pipe(simp);
  simp.pipe(csv).pipe(csvwriter).pipe(fs.createWriteStream(options.csvaliases));
  simp.pipe(csvall).pipe(csvwriterall).pipe(fs.createWriteStream(options.csvall));
//  simp.pipe(JSONStream.stringify()).pipe(writer);

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
