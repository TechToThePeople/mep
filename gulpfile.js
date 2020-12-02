var gulp = require('gulp');
var runSequence = require('run-sequence');
var replace = require('gulp-replace');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var minify = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');
var download = require("gulp-download-stream");
var fs = require("fs");
//var xz = require("xz");
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var rename = require("gulp-rename");
const tf = require('gulp-transform');
const through2 = require("through2");
var transform = require("./script/transform.js");
var mepid = require("./script/meps_str.js");
var inout = require("./script/inout.js");

const resolve = require('path').resolve;

//var decompression = new xz.Decompressor();
var paths = {
  css: [
    'node_modules/dc/dc.css'
   ,'node_modules/bootstrap/dist/css/bootstrap.css'
   ,'node_modules/d3-tip/examples/example-styles.css'
//        'node_modules/bootstrap/dist/css/bootstrap-theme.css'
   ,'node_modules/bootstrap-material-design/dist/css/bootstrap-material-design.css'
  ],
  scripts: [
    'node_modules/jquery/dist/jquery.js',
    'node_modules/blueimp-tmpl/js/tmpl.js',
    //	  'node_modules/lodash/lodash.js',
    'node_modules/d3/d3.js',
    'node_modules/d3-tip/index.js',
    'node_modules/crossfilter2/crossfilter.js',
    'node_modules/reductio/reductio.js',
    'node_modules/dc/dc.js',
    'node_modules/bootstrap/dist/js/bootstrap.js',
    //    'node_modules/jquery-lazyload/jquery.lazyload.js',
    'node_modules/moment/moment.js'

  ]

};

gulp.task('download', function() {
  var files = [
    {file:"eugroup.json", url:"https://www.epnewshub.eu/newshub/rest/contributors/find?cType=group"},
    {file: "meps_str.js",url:"http://www.europarl.europa.eu/hemicycle/js/meps_str.js"}, //used by mepid task to generate mepid.json
//    {file: "mepid.json",url:"http://www.europarl.europa.eu/meps/en/mepquicksearch.html?term="},
    { file:"extra_csv.csv", url:"https://raw.githubusercontent.com/eliflab/European-Parliament-Open-Data/master/meps_full_list_with_twitter_accounts.csv"},
    { file:"incoming.xml",url:"http://www.europarl.europa.eu/meps/en/incoming-outgoing/incoming/xml"},
    {file:"outgoing.xml",url:"http://www.europarl.europa.eu/meps/en/incoming-outgoing/outgoing/xml"},

    {file:"ep_meps_current.json.lz",url:"https://parltrack.org/dumps/ep_meps.json.lz"},
    {file:"epnewshub.json",url:"https://www.epnewshub.eu/newshub/rest/contributors/find?limit=900&cType=mep"}
  ];
  //run script to convert meps_str
  return download(files)
    .pipe(gulp.dest('data'));
});

gulp.task('genderify', function() {
  var gender = function (content) {
    var meps=JSON.parse(content);
    var nogender="epid,gender,first_name,last_name\n";
    meps.forEach(function(d){
      if (!d.Gender) nogender+=[d.epid,"",d.first_name,d.last_name].join(",") +"\n";
    });
    return nogender;
  }

  var fname = "data/meps.json";
  return gulp.src(fname)
    .pipe(through2.obj(function(file, enc, cb) {
      file.contents=new Buffer(gender(file.contents.toString(enc)));
      cb(null,file);
    }))
    .pipe(rename({
      extname: '.new.nogender.csv'
    }))
    .pipe(through2.obj(function(file, enc, cb) {
      console.log("add the missing genders to " +file.path);
      ("http://www.europarl.europa.eu/meps/en/incoming-outgoing.html");
      cb(null,file);
    }))
    .pipe(gulp.dest('data'));
//    .pipe(process.stdout);
//    .pipe(tf('utf-8',gender))
  ;
  
});
gulp.task('decompress', function(done) {
  var fname = "ep_meps_current.json";
  var exec = require('child_process').exec;
  exec("lunzip data/"+fname+".lz -f");
  done();
});

gulp.task("alias", function(done) {
  var aliases = require("./script/aliases.js");
  var cb = function() {
    console.log("finished " + transform.processed);
    done();
  };
  aliases.write({
  from: "data/ep_meps_current.json",
  csvaliases: "data/meps-aliases.csv",
  csvall: "data/meps.all.csv",
  json: 'data/meps-aliases.json'
}, cb);
});

gulp.task("mepid", (done) => {
  mepid(done);
})

gulp.task("inout", (done) => {
  inout(done);
})

gulp.task("transform", function(done) {
  var cb = function() {
    console.log("finished " + transform.processed);
    done();
  };
  transform.write({
    from: resolve("./data/ep_meps_current.json"),
    json: "./data/meps.json",
    csv: "./data/meps.csv"
  }, cb);
});

gulp.task('html', function(){
  return gulp.src(['src/index.html'])
    .pipe(replace("$UPDATE_DATE",new Date().toISOString().slice(0, 10)))
    .pipe(replace("../data/",'data/'))
    .pipe(replace("../build/",'build/'))
    .pipe(gulp.dest("."))
});

gulp.task('update',gulp.series(
  'download','decompress', 'mepid','inout','transform','alias','html',function(d){console.log("done")}));



gulp.task('css', function() {
  return gulp.src(paths.css)
    .pipe(sourcemaps.init())
    .pipe(concat('all.css'))
    .pipe(minify({
      level: {
        1: {
          specialComments: 0
        }
      }
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('build/css'));
});

gulp.task('js', function() {
  // with sourcemaps all the way down 
  return gulp.src(paths.scripts)
    .pipe(sourcemaps.init())
    .pipe(concat('all.js'))
    .pipe(gulp.dest('build/js'))
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('build/js'));
});


gulp.task('build', gulp.parallel('css', 'js'));
gulp.task('default', gulp.series('update'));
