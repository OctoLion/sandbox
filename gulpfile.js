var gulp = require('gulp'),
  gulpUtil = require('gulp-util'),
  gulpShell = require('gulp-shell'),
  gulpSourcemaps = require('gulp-sourcemaps'),
  gulpUglify = require('gulp-uglify'),
  gulpInsert = require('gulp-insert'),
  gulpIf = require('gulp-if'),
  gulpSassGlob = require('gulp-sass-glob'),
  gulpPostcss = require('gulp-postcss'),
  gulpSass = require('gulp-sass'),
  gulpMinifyCSS = require('gulp-minify-css'),
  gulpSassLint = require('gulp-sass-lint'),
  sourceStream = require('vinyl-source-stream'),
  buffer = require('vinyl-buffer'),
  autoprefixer = require('autoprefixer'),
  through = require('through2'),
  browserSync = require('browser-sync'),
  browserify = require('browserify'),
  lost = require('lost'),
  globby = require('globby'),
  del = require('del'),
  browserifyShim = require('browserify-shim'),
  path = require('path');

var uglifyOptions = {
  compress: {
    sequences: false
  }
};

// Build styleguide.
gulp.task('styleguide', gulpShell.task([
  // kss-node [source   folder of files to parse] [destination folder] --template [location of template files]
  'node_modules/.bin/kss <%= source %> <%= destination %> --builder <%= builder %> --namespace <%= namespace %> ' +
  '--js /js/loader.js --css /css/theme.css'
], {
  templateData: {
    source: 'components',
    destination: 'styleguide',
    builder: 'kss-twig-builder',
    namespace: 'sandbox:.'
  }
}));

gulp.task('build', ['clean', 'styles', 'browserify', 'styleguide', 'lint']);

// Static server
gulp.task('watch', ['build'], function () {
  browserSync.init({
    server: {
      baseDir: ".",
      https: true
    },
    startPath: "/styleguide",
    port: 3902
  });

  gulp.watch(['components/**/*.scss', 'scss/**/*.scss'], ['styles', 'lint']);

  gulp.watch(['components/**/*.{twig,hbs}', 'scss/**/*.{twig,hbs}'], ['styleguide', browserSync.reload]);

  gulp.watch(['src/js/loader.js'], ['browserify:loader', browserSync.reload]);

  gulp.watch(['components/**/*.js'], ['browserify:components', browserSync.reload]);
});

gulp.task('styles', function () {
  return gulp.src('scss/theme.scss')
    .pipe(gulpSassGlob())
    .pipe(gulpSass())
    .pipe(gulpPostcss([
      lost(),
      autoprefixer({
        browsers: ['last 2 versions', 'iOS >= 8', 'Safari >= 8']
      })
    ]))
    .pipe(gulpMinifyCSS())
    .pipe(gulp.dest('css'));
});

gulp.task('browserify', ['browserify:loader', 'browserify:components']);

gulp.task('browserify:components', function () {
  // Setup a separate stream using through2 so that we can run globby
  // asynchronously and pipe it into the stream when it completes, letting
  // gulp optimize the task.
  var bundledStream = through();
  bundledStream
    .pipe(sourceStream('bundle.js'))
    .pipe(buffer())
    .pipe(gulpSourcemaps.init({loadMaps: true}))
      .pipe(gulpUglify(uglifyOptions)).on('error', gulpUtil.log)
    .pipe(gulpSourcemaps.write('./', {
        sourceMappingURLPrefix: 'https://localhost:3902/js'
      }))
    // KLUDGE: Chrome Inspector has a known bug/feature where dynamically-loaded
    // scripts do not appear in the Inspector's source tab. In order to force
    // our bundle.js to be included in the Inspector we have to add a sourceURL
    // directive that Chrome parses to give the script an identifier. The bundle
    // will then show up in the Inspector sources tab under the "(no domain)"
    // group with whatever identifier was specified in the sourceURL directive.
    // See http://stackoverflow.com/questions/9092125/how-to-debug-dynamically-loaded-javascriptwith-jquery-in-the-browsers-debugge
    .pipe(gulpIf(shouldAppendSourceUrl, gulpInsert.transform(appendSourceUrl('js'))))
    .pipe(gulp.dest('js'));


  // configure what we want to expose

  // Search for component scripts asynchronously using globbing and then
  // bundle them using browserify.
  globby(['components/**/*.js']).then(function (entries) {
    // Once we have all of the script files from the filesystem we bundle
    // them using browserify and emit them into the stream.
    var bundler = browserify(entries, {
      debug: true,
    }).transform(browserifyShim, {global: true});
    bundler.bundle().pipe(bundledStream);
  }).catch(function (error) {
    // If there are any errors in the globbing we emit an error in the stream
    // so that gulp can report it.
    bundledStream.emit('error', error);
  });

  return bundledStream;
});

gulp.task('browserify:loader', function () {
  return browserify('src/js/loader.js', {
      debug: true,
    }).transform(browserifyShim, {global: true})
    .bundle()
    .pipe(sourceStream('loader.js'))
    .pipe(buffer())
    .pipe(gulpSourcemaps.init({loadMaps: true}))
      .pipe(gulpUglify(uglifyOptions)).on('error', gulpUtil.log)
    .pipe(gulpSourcemaps.write('./'))
    .pipe(gulp.dest('js'));
});

gulp.task('clean', function () {
  return del(['styleguide/*', '!styleguide/.gitkeep']);
});

gulp.task('lint', function () {
  return gulp.src('components/**/*.s+(a|c)ss')
    .pipe(gulpSassLint())
    .pipe(gulpSassLint.format())
    .pipe(gulpSassLint.failOnError());
});

// Determine whether a file should be appended with a sourceURL directive. Only
// javascript and css files should have this directive, and in particular
// sourcemap files will be malformed if this directive is appended to them.
function shouldAppendSourceUrl(file) {
  var extname = path.extname(file.relative);
  return ['.js'].indexOf(extname) > -1;
}

// Returns a transform function that appends a sourceURL directive to the end of
// a vinyl record's content. The baseUrl argument specifies a the base URL
// appended to the file's relative path when constructing the sourceURL.
function appendSourceUrl(baseUrl) {
  return function (contents, file) {
    var sourceUrlComment = '//# sourceURL=' + baseUrl + '/' + file.relative;
    return contents + sourceUrlComment + "\n";
  }
}
