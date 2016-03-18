var gulp = require('gulp');

var Karma = require('karma').Server;
function test(file) {
    return function(done) {
        new Karma({configFile:__dirname + '/' + file, singleRun:true}, done).start();
    }
}

gulp.task('test', test('karma.conf.js'));

gulp.task('default', ['test']);