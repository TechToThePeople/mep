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
var stream = StreamFilteredArray.make({
  objectFilter: f
});
var transform = s.Transform;

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
      } else {
        delete item.Organization;
      }
      if (item.committee_id) delete item.committee_id;
      r.push(item);
    });
    d[attr] = r;
  }
  delete d.changes;
  delete d._id;
  delete d.Name.aliases;
  delete d.Name.full;
  delete d.activities; // stuff might be to be kept there
  activeOnly("Delegations");
  activeOnly("Committees");
  activeOnly("Constituencies");
  activeOnly("Groups");
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
  this.push(JSON.stringify(clean(chunk.value)))

  callback();
});

stream.output.pipe(simp);

stream.output.on("end", function() {
  console.log("done" + total);
});

let fname = path.join(__dirname, 'data/ep_meps_current.json');
fs.createReadStream(fname).pipe(stream.input)
var writer = fs.createWriteStream(path.join(__dirname, 'data/meps.json'));
//simp.pipe(process.stdout);
simp.pipe(writer);