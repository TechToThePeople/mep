'use strict';
const   file = require("fs");

var finished = function(n) {
  console.log("Processed " + n)
};
var total = 0;
const head = ['epid', 'alias','active'];
const headall = ['epid','firstname','lastname','active','start','end','birthdate','country','gender','eugroup','party'];
const fs = require('fs');
const util = require('util');
const path = require('path');
const through2 = require('through2')
const JSONStream = require('JSONStream');
const StreamFilteredArray = require("stream-json/utils/StreamFilteredArray");

var mepid= require('../data/mepid.json'); // direct from EP site, for QA
var csvparse=require('csv-parse/lib/sync.js');

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
  var t={start:d.Constituencies[0].start,end:d.Constituencies[0].end,country:d.Constituencies[0].country,party:d.Constituencies[0].party};
  var getFromTo= function(){
    d.Constituencies.forEach(function(c){
      if (!c) return;// deal with incomplete
      if (c.start < t.start) t.start = c.start;
      if (c.end > t.end) t.end = d.end;
    });
  }

  t.birthdate=d.Birth ? d.Birth.date.replace("T00:00:00", "") : null;
  t.gender=d.Gender;
  t.active=d.active;
  t.aliases=d.Name.aliases;
  t.firstname=d.Name.sur;
  t.lastname=d.Name.family;
  t.epid=d.UserID;
  t.eugroup=d.Groups ? d.Groups[0].groupid : "";
  if (Array.isArray(t.eugroup)){
    t.eugroup = t.eugroup.join("/");
  }
  getFromTo();
  t.start=t.start.replace("T00:00:00", "");
  t.end= t.active ? "" : t.end.replace("T00:00:00", "");
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
  csvall.push([mep.epid,mep.firstname,mep.lastname,mep.active,mep.start,mep.end,mep.birthdate,mep.country,mep.gender,mep.eugroup,mep.party]);
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
