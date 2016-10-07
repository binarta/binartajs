function BinartaApplicationjs(deps) {
    var app = this;
    app.localStorage = deps && deps.localStorage ? deps.localStorage : localStorage;
    app.sessionStorage = deps && deps.sessionStorage ? deps.sessionStorage : sessionStorage;

    var profileCache = {};
    var cachedLocale;

    app.eventRegistry = new BinartaRX();
    app.adhesiveReading = new ReadOnceAdhesiveReading(new AdhesiveReading(app));
    app.config = new Config(app.adhesiveReading);

    app.refresh = function (onSuccess) {
        refreshLocale();
        refreshApplicationProfile(onSuccess);
    };

    app.profile = function () {
        return profileCache;
    };

    app.locale = function () {
        return cachedLocale;
    };

    app.setLocale = function (locale) {
        app.localStorage.locale = locale;
        app.sessionStorage.locale = locale;
        cachedLocale = locale;
        app.eventRegistry.forEach(function (l) {
            l.notify('setLocale', locale);
        });
    };

    app.supportedLanguages = function () {
        return app.profile().supportedLanguages || [];
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
        cachedLocale = app.sessionStorage.locale || app.localStorage.locale || undefined;
        app.sessionStorage.locale = cachedLocale;
    }

    function AdhesiveReading(app) {
        var self = this;

        self.handlers = new BinartaRX();
        self.eventRegistry = new BinartaRX();
        self.executor = new CountdownExecutor(self.eventRegistry);

        function CountdownExecutor(eventRegistry) {
            var self = this;
            var count = 0;

            self.execute = function (cb) {
                if (count++ == 0)
                    eventRegistry.forEach(function (l) {
                        l.notify('start');
                    });
                cb();
            };

            self.countdown = function () {
                if (--count == 0)
                    eventRegistry.forEach(function (l) {
                        l.notify('stop');
                    });
            }
        }

        self.read = function (id) {
            self.executor.execute(function () {
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

    function Config(adhesiveReading) {
        var config = this;
        var configCache = {};

        adhesiveReading.handlers.add({type: 'config', cache: function(it) {
            config.cache(it.key, it.value);
        }});

        this.findPublic = function (key, success) {
            if(!configCache[key])
                app.gateway.findPublicConfig({id: key}, {
                    success: function (value) {
                        config.cache(key, value);
                        success(value);
                    },
                    notFound: function () {
                        success('');
                    }
                });
            else
                success(configCache[key]);
        };

        this.cache = function (key, value) {
            configCache[key] = value
        }
    }
}