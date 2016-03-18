module.exports = function (config) {
    config.set({
        basePath: '.',
        frameworks: ['jasmine'],
        files: [
            {pattern: 'src/**/*.js'},
            {pattern: 'test/**/*.js'}
        ],
        browsers: ['PhantomJS'],
        reporters: ['dots', 'junit'],
        junitReporter: {
            outputFile: 'test-results.xml',
            useBrowserName: false
        }
    });
};