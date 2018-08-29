function BinartaApplicationjs(deps) {
    var app = this;
    var timeline = deps && deps.timeline || new BinartaTL();
    app.window = deps && deps.window ? deps.window : window;
    app.localStorage = deps && deps.localStorage ? deps.localStorage : WebStorageFactory('localStorage');
    app.sessionStorage = deps && deps.sessionStorage ? deps.sessionStorage : WebStorageFactory('sessionStorage');

    var profileCache;
    var cachedLocale, cachedLocaleForPresentation;
    var localeSelector = new LocaleSelector(app);

    app.eventRegistry = new BinartaRX();
    app.adhesiveReading = new AdhesiveReading(app);
    app.config = new Config(app.adhesiveReading);
    app.cookies = new Cookies();
    app.lock = new Lock();

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

        self.read = function () {
            self.executor.execute(function () {
                app.gateway.fetchAdhesiveSnapshot({locale: app.localeForPresentation() || app.locale()}, {
                    success: function (snapshot) {
                        cache(snapshot);
                        self.executor.countdown();
                    }
                });
            });
        };

        function cache(snapshot) {
            var stream = (snapshot.stream == undefined ? snapshot : snapshot.stream); // testing for backwards compatibility
            stream.forEach(function (it) {
                it.timestamp = snapshot.timestamp;
                self.handlers.forEach(function (h) {
                    if (h.type == it.type)
                        h.notify('cache', it);
                });
            });
        }

        app.eventRegistry.add({
            setLocale: self.read
        });
    }

    function Config(adhesiveReading) {
        var config = this;
        var configCache;
        var eventHandlers = new BinartaRX();

        adhesiveReading.handlers.add({
            type: 'config', cache: function (it) {
                config.cache(it.key, it.value, it.timestamp);
            }
        });

        function addConfig(request, response) {
            var adapter = app.binarta.toResponseAdapter(response);
            adapter.success = function () {
                if (response && response.success)
                    response.success(request.value);
            };
            app.gateway.addConfig(request, adapter);
        }

        this.addPublic = function (request, response) {
            request.scope = 'public';
            var adapter = app.binarta.toResponseAdapter(response);
            adapter.success = function () {
                config.cache(request.id, request.value, moment());
                app.sessionStorage.setItem('binarta:config:' + request.id, JSON.stringify({
                    timestamp: moment(timeline.shift()).format('YYYYMMDDHHmmssSSSZ'),
                    value: request.value
                }));
                if (response && response.success)
                    response.success(request.value);
            };
            addConfig(request, adapter);
        };

        this.addSystem = function (request, response) {
            request.scope = 'system';
            addConfig(request, response);
        };

        this.findPublic = function (key, success) {
            var cachedConfig = fromSessionCache(key, configCache[key]);
            if (cachedConfig == undefined)
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
                success(cachedConfig);
        };

        function fromSessionCache(key, fallback) {
            var sessionKey = 'binarta:config:' + key;
            var it = app.sessionStorage.getItem(sessionKey);
            if (!it) return fallback ? fallback.value : undefined;
            it = JSON.parse(it);
            if (fallback && moment(it.timestamp, 'YYYYMMDDHHmmssSSSZ') < fallback.timestamp) {
                app.sessionStorage.removeItem(sessionKey);
                return fallback.value;
            }
            return it.value;
        }

        this.findSystem = function (key, response) {
            app.gateway.findConfig({scope: 'system', id: key}, {
                success: function (value) {
                    response.success(value);
                },
                notFound: function () {
                    response.success('');
                },
                unauthenticated: response.unauthenticated,
                forbidden: response.forbidden
            });
        };

        function observeConfig(key, success, cb) {
            var listener = {};
            listener[key] = success;
            var observer = eventHandlers.observe(listener);
            cb();
            return observer;
        }

        this.observePublic = function (key, success) {
            return observeConfig(key, success, function () {
                config.findPublic(key, success);
            });
        };

        this.observeSystem = function (key, success) {
            return observeConfig(key, success, function () {
                config.findSystem(key, {
                    success: success,
                    unauthenticated: function () {
                        success('');
                    },
                    forbidden: function () {
                        success('');
                    }
                });
            });
        };

        this.cache = function (key, value, timestamp) {
            var entry = {value: value, timestamp: timestamp};
            configCache[key] = entry;
            eventHandlers.forEach(function (l) {
                l.notify(key, fromSessionCache(key, entry));
            });
        };

        this.clear = function () {
            configCache = {};
        };
        this.clear();
    }

    function Cookies() {
        var cookies = this;

        cookies.permission = new Permission();

        function Permission() {
            var permission = this;

            permission.status;

            permission.eventRegistry = new BinartaRX();
            permission.blacklist = [
                'phantomjs',
                'googlebot',
                'bingbot',
                'yandex',
                'baiduspider',
                'twitterbot',
                'facebookexternalhit',
                'rogerbot',
                'linkedinbot',
                'embedly',
                'quora link preview',
                'showyoubot',
                'outbrain',
                'pinterest',
                'slackbot',
                'vkShare',
                'W3C_Validator',
                'developers.google.com/+/web/snippet',
                'www.google.com/webmasters/tools/richsnippets',
                'redditbot',
                'Applebot',
                'WhatsApp',
                'flipboard',
                'tumblr',
                'bitlybot',
                'SkypeUriPreview',
                'nuzzel',
                'Discordbot',
                'Google Page Speed',
                'Qwantify'
            ];

            permission.grant = function () {
                localStorage.cookiesAccepted = true;
                permission.evaluate();
                permission.eventRegistry.notify('granted');
            };

            permission.revoke = function () {
                localStorage.cookiesAccepted = false;
                permission.evaluate();
            };

            permission.evaluate = function () {
                if (localStorage.cookiesAccepted == 'true' || permission.blacklist.some(function (it) {
                        return app.window.navigator.userAgent.toLowerCase().indexOf(it) != -1;
                    }))
                    permission.status = 'permission-granted';
                else if (localStorage.cookiesAccepted == 'false')
                    permission.status = 'permission-revoked';
                else
                    permission.status = localStorage.storageAvailable == 'true' ? 'permission-required' : 'permission-storage-disabled';
            };

            permission.evaluate();
        }
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

    function Lock() {
        var self = this;

        self.status = 'open';

        self.reserve = function () {
            self.status = 'closed';
            app.eventRegistry.forEach(function (l) {
                l.notify('editing');
            });
        };

        self.release = function () {
            self.status = 'open';
            app.eventRegistry.forEach(function (l) {
                l.notify('viewing');
            });
        }
    }
}
