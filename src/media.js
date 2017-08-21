function BinartaMediajs(args) {
    var media = this;
    var checkpoint = args.checkpointjs;
    var timeline = args.timeline || new BinartaTL();

    this.images = new ImageDictionary();

    function ImageDictionary() {
        var images = this;

        this.toURL = function (args) {
            var params = ['width', 'height'].filter(function (it) {
                return args[it];
            }).map(function (it) {
                return it + '=' + Math.floor(args[it]);
            });

            if (args.section)
                params.push('section=' + args.section);
            if (isCacheDisabled())
                params.push('timestamp=' + getTimestamp());

            var queryString = params.join('&');
            return args.path + (queryString ? (args.path.indexOf('?') == -1 ? '?' : '&') + queryString : '');
        };

        this.resetTimestamp = function () {
            if (isImageUploadFeatureAvailable())
                setTimestamp(timeline.shift().getTime());
        };

        function isImageUploadFeatureAvailable() {
            return checkpoint.profile.hasPermission('image.upload');
        }

        function isCacheDisabled() {
            return null != media.binarta.sessionStorage.getItem('binartaImageTimestamp') && (timeline.shift().getTime() < (parseInt(media.binarta.sessionStorage.getItem('binartaImageTimestamp')) + 300000));
        }

        function getTimestamp() {
            return media.binarta.sessionStorage.getItem('binartaImageTimestamp');
        }

        function setTimestamp(timestamp) {
            media.binarta.sessionStorage.setItem('binartaImageTimestamp', timestamp);
        }

        checkpoint.profile.eventRegistry.observe({
            signedin: images.resetTimestamp
        });
    }
}