function BinartaApplicationjs(deps) {
    var app = this;
    app.localStorage = deps && deps.localStorage ? deps.localStorage : WebStorageFactory('localStorage');
    app.sessionStorage = deps && deps.sessionStorage ? deps.sessionStorage : WebStorageFactory('sessionStorage');

    var profileCache;
    var cachedLocale, cachedLocaleForPresentation;
    var localeSelector = new LocaleSelector(app);

    app.eventRegistry = new BinartaRX();
    app.adhesiveReading = new ReadOnceAdhesiveReading(app, new AdhesiveReading(app));
    app.config = new Config(app.adhesiveReading);

    app.installed = function () {
        extendBinartaWithJobScheduler();
    };

    app.isRefreshed = function () {
        return profileCache != undefined;
    };

    app.refresh = function (onSuccess) {
        refreshApplicationProfile(onSuccess);
    };

    app.profile = function () {
        return profileCache || {};
    };

    app.locale = function () {
        return cachedLocale;
    };

    app.setLocale = function (locale) {
        var changed = cachedLocale != locale;
        app.localStorage.locale = locale;
        cachedLocale = locale;
        if (changed)
            app.eventRegistry.forEach(function (l) {
                l.notify('setLocale', locale);
            });
    };

    app.localeForPresentation = function () {
        return cachedLocaleForPresentation;
    };

    app.setLocaleForPresentation = function (locale) {
        var changed = cachedLocaleForPresentation != locale;
        cachedLocaleForPresentation = locale;
        localeSelector.setLocaleForPresentation(locale);
        if (changed)
            app.eventRegistry.forEach(function (l) {
                l.notify('setLocaleForPresentation', cachedLocaleForPresentation);
            });
    };

    app.observeLocaleForPresentation = function (cb) {
        var observer = app.eventRegistry.observe({setLocaleForPresentation: cb});
        cb(app.localeForPresentation());
        return observer;
    };

    app.supportedLanguages = function () {
        return app.profile().supportedLanguages || [];
    };

    app.primaryLanguage = function () {
        return app.supportedLanguages() ? app.supportedLanguages()[0] : undefined;
    };

    function extendBinartaWithJobScheduler() {
        app.binarta.$scheduler = new JobScheduler();
        app.adhesiveReading.eventRegistry.add(app.binarta.$scheduler);
        app.binarta.schedule = app.binarta.$scheduler.execute;
    }

    function refreshApplicationProfile(onSuccess) {
        app.gateway.fetchApplicationProfile({}, {
            success: function (profile) {
                app.setProfile(profile);
                if (onSuccess)
                    onSuccess();
            }
        });
    }

    app.setProfile = function (profile) {
        profileCache = profile;
        app.refreshEvents();
    };

    app.refreshEvents = function () {
        localeSelector.setPrimaryLanguage(app.primaryLanguage());
        app.eventRegistry.forEach(function (l) {
            l.notify('setPrimaryLanguage', app.primaryLanguage());
        });
    };

    function LocaleSelector(app) {
        var primaryLanguage, localeForPresentation, isPrimaryLanguageUnlocked, isLocaleForPresentationUnlocked;

        this.setPrimaryLanguage = function (locale) {
            primaryLanguage = locale;
            isPrimaryLanguageUnlocked = true;
            execute();
        };

        this.setLocaleForPresentation = function (locale) {
            localeForPresentation = locale;
            isLocaleForPresentationUnlocked = true;
            execute();
        };

        function execute() {
            if (isPrimaryLanguageUnlocked && isLocaleForPresentationUnlocked) {
                if (primaryLanguage && !localeForPresentation) {
                    app.setLocaleForPresentation(primaryLanguage);
                } else if (!primaryLanguage && localeForPresentation)
                    app.eventRegistry.forEach(function (l) {
                        l.notify('unlocalized')
                    });
                else if (localeForPresentation && notSupported(localeForPresentation))
                    app.eventRegistry.forEach(function (l) {
                        l.notify('applyLocale', primaryLanguage)
                    });
                else
                    app.setLocale(primaryLanguage != localeForPresentation ? localeForPresentation : 'default');
            }
        }

        function notSupported(locale) {
            return app.supportedLanguages().indexOf(locale) == -1
        }
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
                app.gateway.fetchSectionData({id: id, locale: app.localeForPresentation() || app.locale()}, {
                    success: function (stream) {
                        cache(stream);
                        self.executor.countdown();
                    }
                });
            });
        };

        self.cache = function(stream) {
            self.executor.execute(function() {
                cache(stream);
                self.executor.countdown();
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

    function ReadOnceAdhesiveReading(app, delegate) {
        var self = this;
        var alreadyRead = {};

        function isAlreadyRead(id) {
            if (alreadyRead[app.locale()] == undefined)
                alreadyRead[app.locale()] = [];
            return alreadyRead[app.locale()].indexOf(id) == -1
        }

        function remember(id) {
            alreadyRead[app.locale()].push(id);
        }

        self.handlers = delegate.handlers;
        self.eventRegistry = delegate.eventRegistry;
        self.read = function (id) {
            if (isAlreadyRead(id)) {
                remember(id);
                delegate.read(id);
            }
        };
        self.cache = function(id, stream) {
            if(isAlreadyRead(id)) {
                remember(id);
                delegate.cache(stream);
            }
        }
    }

    function Config(adhesiveReading) {
        var config = this;
        var configCache;
        var eventHandlers = new BinartaRX();

        adhesiveReading.handlers.add({
            type: 'config', cache: function (it) {
                config.cache(it.key, it.value);
            }
        });

        this.findPublic = function (key, success) {
            if (configCache[key] == undefined)
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

        this.observePublic = function (key, success) {
            var listener = {};
            listener[key] = success;
            var observer = eventHandlers.observe(listener);
            config.findPublic(key, success);
            return observer;
        };

        this.cache = function (key, value) {
            configCache[key] = value;
            eventHandlers.forEach(function (l) {
                l.notify(key, value);
            });
        };

        this.clear = function () {
            configCache = {};
        };
        this.clear();
    }

    function JobScheduler() {
        var self = this;
        self.$jobs = [];
        var initialised = false;

        this.stop = function () {
            initialised = true;
            self.$jobs.forEach(function (it) {
                it();
            });
            self.$jobs = [];
        };

        this.execute = function (job) {
            if (initialised)
                job();
            else
                self.$jobs.push(job);
        }
    }
}