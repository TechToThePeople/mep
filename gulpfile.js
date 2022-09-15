
const fs = require("fs");
const path = require("path");

const gulp = require("gulp");
const gulp_replace = require("gulp-replace");
const gulp_sourcemaps = require("gulp-sourcemaps");
const gulp_concat = require("gulp-concat");
const gulp_uglify = require("gulp-uglify");
const gulp_minify = require("gulp-clean-css");
const gulp_rename = require("gulp-rename");

const lunzip = require("lunzip-stream");
const downloader = require("./lib/download");

// config

const paths = {
	css: [
		'node_modules/dc/dc.css',
		'node_modules/bootstrap/dist/css/bootstrap.css',
		'node_modules/d3-tip/examples/example-styles.css',
		// 'node_modules/bootstrap/dist/css/bootstrap-theme.css',
		'node_modules/bootstrap-material-design/dist/css/bootstrap-material-design.css',
	],
	scripts: [
		'node_modules/jquery/dist/jquery.js',
		'node_modules/blueimp-tmpl/js/tmpl.js',
		// 'node_modules/lodash/lodash.js',
		'node_modules/d3/d3.js',
		'node_modules/d3-tip/index.js',
		'node_modules/crossfilter2/crossfilter.js',
		'node_modules/reductio/reductio.js',
		'node_modules/dc/dc.js',
		'node_modules/bootstrap/dist/js/bootstrap.js',
		// 'node_modules/jquery-lazyload/jquery.lazyload.js',
		'node_modules/moment/moment.js',
	]
};

// tasks

const download = exports.download = function download(done){
	return downloader([
		{ file: "eugroup.json", url: "https://www.epnewshub.eu/v1/contributor/?type=grouppress&pageSize=50&search-value=&search-type=contributor" },
		{ file: "meps_str.js", url: "https://www.europarl.europa.eu/hemicycle/js/meps_str.js" }, //used by mepid task to generate mepid.json
		{ file: "extra_csv.csv", url: "https://raw.githubusercontent.com/eliflab/European-Parliament-Open-Data/master/meps_full_list_with_twitter_accounts.csv" },
		{ file: "incoming.xml", url: "https://www.europarl.europa.eu/meps/en/incoming-outgoing/incoming/xml" },
		{ file: "outgoing.xml", url: "https://www.europarl.europa.eu/meps/en/incoming-outgoing/outgoing/xml" },
		{ file: "ep_meps_current.json.lz", url: "https://parltrack.org/dumps/ep_meps.json.lz" },
		{ file: "epnewshub.json", url: "https://www.epnewshub.eu/v1/contributor/?type=mep&pageSize=1000&search-value=&search-type=contributor" },
	].map(function(src){
		src.file = path.resolve(__dirname,"data",src.file);
		return src;
	}), function(){
		done();
	});
};

const decompress = exports.decompress = function decompress(done) {
	return fs.createReadStream('data/ep_meps_current.json.lz').pipe(lunzip()).pipe(fs.createWriteStream("data/ep_meps_current.json").on("end", done));
};

const mepid = exports.mepid = function mepid(done) {
	require("./script/meps_str.js")(done);
};

const inout = exports.inout = function inout(done) {
	require("./script/inout.js")(done);
};

const transform = exports.transform = function transform(done) {
	require("./script/transform.js")(done);
};

const alias = exports.alias = function alias(done) {
	require("./script/aliases.js")(done);
};

const html = exports.html = function html(done) {
	return gulp
	.src(['src/index.html'])
	.pipe(gulp_replace("$UPDATE_DATE", new Date().toISOString().slice(0, 10)))
	.pipe(gulp_replace("../data/",'data/'))
	.pipe(gulp_replace("../build/",'build/'))
	.pipe(gulp.dest(".").on("end", done));
};

const css = exports.css = function css(done){
	return gulp
	.src(paths.css)
	.pipe(gulp_sourcemaps.init())
	.pipe(gulp_concat('all.css'))
	.pipe(gulp_minify({
		level: {
			1: {
				specialComments: 0
			}
		}
	}))
	.pipe(gulp_sourcemaps.write('.'))
	.pipe(gulp.dest('build/css').on("end", done));
};

const js = exports.js = function js(done){
	return gulp
	.src(paths.scripts)
	.pipe(gulp_sourcemaps.init())
	.pipe(gulp_concat('all.js'))
	.pipe(gulp.dest('build/js'))
	.pipe(gulp_uglify())
	.pipe(gulp_rename({
		extname: '.min.js'
	}))
	.pipe(gulp_sourcemaps.write('.'))
	.pipe(gulp.dest('build/js').on("end", done));
};

const genderify = exports.genderify = function genderify(done){
	const through2 = require("through2");

	const gender = function(content) {
		let nogender = "epid,gender,first_name,last_name";
		JSON.parse(content).forEach(function(d){
			if (!d.Gender) nogender += "\n"+[d.epid,"",d.first_name,d.last_name].join(",");
		});
		return nogender;
	}

	return gulp
	.src("data/meps.json")
	.pipe(through2.obj(function(file, enc, cb) {
		file.contents = new Buffer.from(gender(file.contents.toString(enc)));
		cb(null, file);
	}))
	.pipe(gulp_rename({
		extname: '.new.nogender.csv'
	}))
	.pipe(through2.obj(function(file, enc, cb) {
		console.log("add the missing genders to " +file.path);
		// ("http://www.europarl.europa.eu/meps/en/incoming-outgoing.html");
		cb(null, file);
	}))
	.pipe(gulp.dest('data').on("end", done));
//	.pipe(process.stdout);
//	.pipe(tf('utf-8',gender))
};

// aliases

exports.build = gulp.parallel(css, js);

exports.default = exports.update = gulp.series(download, decompress, mepid, inout, transform, alias, html);
