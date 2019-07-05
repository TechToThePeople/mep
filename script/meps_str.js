const fs = require('fs');
const JSON5 = require('json5');

function main (callback) {

  var extract_ids=function (){
    var meps=[];
    var k2k=Object.entries({firstName:"prenom",lastName:"nom",group:"group_code",country:"country_code",id:"id_mep","seat":"id_siege"});
    var printError = function(error, explicit) {
      console.log(`[${explicit ? 'EXPLICIT' : 'INEXPLICIT'}] ${error.name}: ${error.message}`);
    }
    var s=fs.readFileSync('data/meps_str.js', "utf8"); //meps_str has a weird format, the array we want (meps_str) starts at 58 chars
    s=s.substring(58, s.length - 2);
    try {
      var ms= JSON5.parse(s);
      ms.forEach(function(m){
        var r={};
        k2k.forEach(function(d){
          r[d[0]]=m[d[1]];
        });
        if (r.country == 'x') return; //council or commission
        meps.push(r);
      });
      //{value: 'CHARLES GOERENSCharles Goerens',nom: 'Goerens',prenom: 'Charles',group_code: 'ALDE',country_code: 'lu',id_mep: 840,id_siege: 325,id_group: 4283

      //[{"value":"Asim ADEMOV","url":"ASIM_ADEMOV","id":189525,"firstName":"Asim","lastName":"ADEMOV"},
    } catch (e) {
      if (e instanceof SyntaxError) {
          printError(e, true);
      } else {
          printError(e, false);
      }
    }
    return meps;

  };

  fs.writeFileSync('./data/mepid.json', JSON.stringify(extract_ids()));
  if (typeof callback == "function") {
    callback();
  }

}

if (require.main === module) {
  main();
} else {
  module.exports = main;
}

