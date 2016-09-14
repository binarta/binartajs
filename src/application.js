function BinartaApplicationjs() {
    var app = this;
    var profileCache = {};
    var cachedLocale;

    app.adhesiveReading = new ReadOnceAdhesiveReading(new AdhesiveReading(app));

    app.profile = function () {
        return profileCache;
    };

    app.locale = function () {
        return cachedLocale;
    };

    app.setLocale = function (locale) {
        localStorage.locale = locale;
        sessionStorage.locale = locale;
        cachedLocale = locale;
    };

    app.refresh = function (onSuccess) {
        refreshLocale();
        refreshApplicationProfile(onSuccess);
    };

    function refreshApplicationProfile(onSuccess) {
        app.gateway.fetchApplicationProfile({}, {
            success: function (profile) {
                profileCache = profile;
                if (onSuccess)
                    onSuccess();
            }
        });
    }

    function refreshLocale() {
        cachedLocale = sessionStorage.locale || localStorage.locale || undefined;
        sessionStorage.locale = cachedLocale;
    }

    function AdhesiveReading(app) {
        var self = this;

        self.handlers = new BinartaRX();
        self.eventRegistry = new BinartaRX();
        self.executor = new CountdownExecutor(self.eventRegistry);

        function CountdownExecutor(eventRegistry) {
            var self = this;
            var count = 0;

            self.execute = function(cb) {
                if(count++ == 0)
                    eventRegistry.forEach(function (l) {
                        l.notify('start');
                    });
                cb();
            };

            self.countdown = function() {
                if(--count == 0)
                    eventRegistry.forEach(function (l) {
                        l.notify('stop');
                    });
            }
        }

        self.read = function (id) {
            self.executor.execute(function() {
                app.gateway.fetchSectionData({id: id, locale: app.locale()}, {
                    success: function (stream) {
                        cache(stream);
                        self.executor.countdown();
                    }
                });
            });
        };

        function cache(stream) {
            stream.forEach(function (it) {
                self.handlers.forEach(function (h) {
                    if (h.type == it.type)
                        h.notify('cache', it);
                });
            });
        }
    }

    function ReadOnceAdhesiveReading(delegate) {
        var self = this;
        var alreadyRead = [];

        self.handlers = delegate.handlers;
        self.eventRegistry = delegate.eventRegistry;
        self.read = function (id) {
            if (alreadyRead.indexOf(id) == -1) {
                alreadyRead.push(id);
                delegate.read(id);
            }
        }
    }
}