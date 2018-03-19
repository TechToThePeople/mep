'use strict';
var fs = require('fs');
var path = require('path');
var csvWriter = require('csv-write-stream');
var parser = require('xml2json');
var argv = require('minimist')(process.argv.slice(2),{alias:{o:"out"}});
const xmlfile = argv._[0];
const vid = argv.id;
var out=process.stdout;
if (!xmlfile) {
  console.log("usage: vote.js XMLVOTE.xml --id vote_id --out");
  process.exit(1);
}

var writerOverview = csvWriter({ headers: ["id","name","date","for","against","abstention"]});
var writerRoll = csvWriter({ headers: ["vote_id","mep_id","eugroup","result","name"]});

if (argv.out) {
  if (argv.out === true) {
    out= vid ? "data/vote/"+vid+".csv" : "data/vote/"+path.basename(xmlfile).replace(".xml", ".csv");
  } else {
    out= argv.out;
  }
  console.log ("writing file "+ out);
  out=fs.createWriteStream(out);
};
if (vid) {
  writerRoll.pipe(out);
} else {
  writerOverview.pipe(out);
}

fs.readFile( xmlfile, function(err, data) {
  var csv=[];
  var json = parser.toJson(data,{object:true});
  json["PV.RollCallVoteResults"]["RollCallVote.Result"].forEach(function(roll){

    var total= function(type){ //type=For,Against,Abstension
      var r=roll['Result.'+type];
      if (!r) return null;
      return r.Number;
    }

    var list = function(type){ //type=For,Against,Abstension
      //const convertType={"For":1,"Against":-1,"Abstention":0};
      const convertType={"For":"for","Against":"against","Abstention":"abstention"};
      var r=roll['Result.'+type]['Result.PoliticalGroup.List'];
      r.forEach(function(group){
        var g=group["PoliticalGroup.Member.Name"];
        if (!Array.isArray(g)) g=[g];//if only one mep
        g.forEach(function(mep){
          writerRoll.write({vote_id:v.id,mep_id:mep.MepId,eugroup:group.Identifier,result:convertType[type],name:mep.$t});
        });
      });
    };

    var v={id:roll.Identifier,name:roll['RollCallVote.Description.Text'],date:roll.Date,for:total('For'),against:total('Against'),abstention:total('Abstention')};
    if (vid) { // we are processing a specific vote only
      if (vid != v.id) return;
      list('For');
      list('Against');
      list('Abstention');
    } else {
      writerOverview.write(v);
    }

  });
  writerOverview.end();
  writerRoll.end();
});
