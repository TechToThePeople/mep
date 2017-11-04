var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var minify = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');
var download = require("gulp-download");
var xz = require("xz");
var rename = require("gulp-rename");
var decompression = new xz.Decompressor();

var paths = {
  css: [
    'node_modules/dc/dc.css',
    'node_modules/bootstrap/dist/css/bootstrap.css',
    'node_modules/bootstrap/dist/css/bootstrap-theme.css'
  ],
  scripts: [
    'node_modules/jquery/dist/jquery.js',
    'node_modules/blueimp-tmpl/js/tmpl.js',
//	  'node_modules/lodash/lodash.js',
    'node_modules/d3/d3.js',
    'node_modules/crossfilter2/crossfilter.js',
    'node_modules/reductio/reductio.js',
    'node_modules/dc/dc.js',
    'node_modules/bootstrap/dist/js/bootstrap.js',
//    'node_modules/jquery-lazyload/jquery.lazyload.js',
    'node_modules/moment/moment.js'
  ]

};
gulp.task('fetch', function() {
  download("http://parltrack.euwiki.org/dumps/ep_meps_current.json.xz")
    .pipe(gulp.dest('data'));
});

gulp.task('decompress', function() {
  var fname="data/ep_meps_current.json";
  var inFile = fs.createReadStream(fname + ".xz");
  var outFile = fs.createWriteStream(fname);
  inFile.pipe(decompression).pipe(outFile);
});

gulp.task('stylesheets', function() {
  // with sourcemaps all the way down 
  return gulp.src(paths.css)
    .pipe(minify())
    .pipe(concat('all.css'))
    .pipe(gulp.dest('build/css'));
});

gulp.task('scripts', function() {
  // with sourcemaps all the way down 
  return gulp.src(paths.scripts)
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(concat('all.min.js'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('build/js'));
});

gulp.task('default', ['scripts', 'stylesheets']);
