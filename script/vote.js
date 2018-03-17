var fs = require('fs');
var csvWriter = require('csv-write-stream');
var parser = require('xml2json');

var argv = require('minimist')(process.argv.slice(2));

const xmlfile = argv._[0];
const id = argv._[1];

if (!xmlfile) {
  console.log("usage: vote.js XMLVOTE");
  process.exit(1);
}

var writer = csvWriter({ headers: ["id","name","date","for","against","abstention"]});
writer.pipe(process.stdout);


fs.readFile( xmlfile, function(err, data) {
  var csv=[];
  var json = parser.toJson(data,{object:true});
  json["PV.RollCallVoteResults"]["RollCallVote.Result"].forEach(function(roll){
    var number= function(type){ //type=For,Against,Abstension
      var r=roll['Result.'+type];
      if (!r) return null;
      return r.Number;
    }
//    console.log(roll);
    var v={id:roll.Identifier,name:roll['RollCallVote.Description.Text'],date:roll.Date,for:number('For'),against:number('Against'),abstention:number('Abstention')};
    writer.write(v);
  });
  writer.end();
});
