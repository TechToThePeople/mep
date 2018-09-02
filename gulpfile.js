var gulp = require('gulp');
var runSequence = require('run-sequence');
var replace = require('gulp-replace');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var minify = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');
var download = require("gulp-download-stream");
var fs = require("fs");
var xz = require("xz");
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var rename = require("gulp-rename");
const tf = require('gulp-transform');
const through2 = require("through2");
var transform = require("./script/transform.js");
const resolve = require('path').resolve;

var decompression = new xz.Decompressor();

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

gulp.task('download-img", function(){
});

gulp.task('download', function() {
  var files = [{file: "mepid.json",url:"http://www.europarl.europa.eu/meps/en/mepquicksearch.html?term="},
    {file:"ep_meps_current.json.xz",url:"http://parltrack.euwiki.org/dumps/ep_meps_current.json.xz"}];
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
      extname: '.nogender.csv'
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
gulp.task('decompress', function() {
  var fname = "data/ep_meps_current.json";
  var inFile = fs.createReadStream(fname + ".xz");
  var outFile = fs.createWriteStream(fname);
  return inFile.pipe(decompression).pipe(outFile);
});

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

gulp.task('update', function (callback) {
  runSequence('download','decompress', 'transform','html',callback);
  });

gulp.task('html', function(){
  return gulp.src(['src/index.html'])
    .pipe(replace("$UPDATE_DATE",new Date().toISOString().slice(0, 10)))
    .pipe(replace("../data/",'data/'))
    .pipe(replace("../build/",'build/'))
    .pipe(gulp.dest("."))
});

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


gulp.task('build', ['css', 'js']);
gulp.task('default', ['update']);
