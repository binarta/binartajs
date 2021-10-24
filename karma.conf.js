module.exports = function (config) {
    config.set({
        basePath: '.',
        frameworks: ['jasmine'],
        files: [
            {pattern:'bower_components/binarta.web.storage/src/web.storage.js'},
            {pattern:'bower_components/moment/moment.js'},
            {pattern: 'src/**/*.js'},
            {pattern: 'test/**/*.js'}
        ],
        browsers: ['ChromeHeadless'],
        reporters: ['dots', 'junit'],
        junitReporter: {
            outputFile: 'test-results.xml',
            useBrowserName: false
        }
    });
};