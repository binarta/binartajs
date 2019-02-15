(function () {
    describe('binarta-applicationjs', function () {
        var binarta, ui, now, window;

        beforeEach(function () {
            localStorage.removeItem('locale');
            sessionStorage.removeItem('locale');
            localStorage.setItem('storageAvailable', 'true');
        });
        beforeEach(function () {
            now = new Date();
            window = {navigator: {userAgent: 'test'}};

            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({
                application: new BinartaApplicationjs({
                    timeline: [now],
                    window: window
                })
            });
            binarta = factory.create();

            binarta.application.gateway = new ValidApplicationGateway();
        });

        afterEach(function () {
            sessionStorage.removeItem('binarta:config:k');
            sessionStorage.removeItem('binarta:config:adhesive.config');
            localStorage.removeItem('cookiesAccepted');
        });

        it('exposes an empty profile', function () {
            expect(binarta.application.profile()).toEqual({});
        });

        it('exposes an empty list of supported languages', function () {
            expect(binarta.application.supportedLanguages()).toEqual([]);
        });

        it('the primary language is undefined', function () {
            expect(binarta.application.primaryLanguage()).toBeUndefined();
        });

        it('expose application is not yet refreshed state', function () {
            expect(binarta.application.isRefreshed()).toBeFalsy();
        });

        it('on refresh request profile data', function () {
            binarta.application.gateway = new GatewaySpy();
            binarta.application.refresh();
            expect(binarta.application.gateway.fetchApplicationProfileRequest).toEqual({});
        });

        describe('when refresh success', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpyObj('spy', ['setPrimaryLanguage']);
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.eventRegistry.add(spy);
                binarta.application.refresh();
            });

            it('then expose application is refreshed state', function () {
                expect(binarta.application.isRefreshed()).toBeTruthy();
            });

            it('then profile cache is updated', function () {
                expect(binarta.application.profile().name).toEqual('test-application');
            });

            it('then expose supported languages', function () {
                expect(binarta.application.supportedLanguages()).toEqual(['en', 'nl']);
            });

            it('then the primary language is english', function () {
                expect(binarta.application.primaryLanguage()).toEqual('en');
            });

            it('then app event listeners receive a set primary language event', function () {
                expect(spy.setPrimaryLanguage).toHaveBeenCalledWith('en');
            });

            it('and refresh events then listeners receive a set primary language event', function () {
                binarta.application.profile().supportedLanguages = ['fr'];
                binarta.application.refreshEvents();
                expect(spy.setPrimaryLanguage).toHaveBeenCalledWith('fr');
            });
        });

        describe('when passing an optional success listener to refresh', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpy('spy');
            });

            it('and refresh does not complete then listener is not triggered', function () {
                binarta.application.gateway = new GatewaySpy();
                binarta.application.refresh(spy);
                expect(spy).not.toHaveBeenCalled();
            });

            it('and refresh completes then listener is not triggered', function () {
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.refresh(spy);
                expect(spy).toHaveBeenCalled();
            });
        });

        describe('when manually setting profile data', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpyObj('spy', ['applicationProfile', 'setPrimaryLanguage']);
                binarta.application.eventRegistry.add(spy);
                new ValidApplicationGateway().fetchApplicationProfile(undefined, {
                    success: binarta.application.setProfile
                });
            });

            it('then expose application is refreshed state', function () {
                expect(binarta.application.isRefreshed()).toBeTruthy();
            });

            it('then profile cache is updated', function () {
                expect(binarta.application.profile().name).toEqual('test-application');
            });

            it('then expose supported languages', function () {
                expect(binarta.application.supportedLanguages()).toEqual(['en', 'nl']);
            });

            it('then the primary language is english', function () {
                expect(binarta.application.primaryLanguage()).toEqual('en');
            });

            it('then app event listeners receive a set primary language event', function () {
                expect(spy.setPrimaryLanguage).toHaveBeenCalledWith('en');
            });

            it('then app event listeners receive an application profile event', function () {
                expect(spy.applicationProfile).toHaveBeenCalledWith({
                    name: 'test-application',
                    supportedLanguages: ['en', 'nl']
                });
            });

            it('and refresh events then listeners receive a set primary language event', function () {
                binarta.application.profile().supportedLanguages = ['fr'];
                binarta.application.refreshEvents();
                expect(spy.setPrimaryLanguage).toHaveBeenCalledWith('fr');
            });
        });

        describe('locale resolution', function () {
            it('starts out undefined', function () {
                expect(binarta.application.locale()).toBeUndefined();
            });

            describe('when swapped locale', function () {
                var spy;

                beforeEach(function () {
                    spy = jasmine.createSpyObj('spy', ['setLocale']);
                    binarta.application.eventRegistry.add(spy);
                });

                beforeEach(function () {
                    binarta.application.setLocale('swapped-locale');
                });

                it('then locale is saved in local storage', function () {
                    expect(localStorage.locale).toEqual('swapped-locale');
                });

                it('then locale resolves without refresh', function () {
                    expect(binarta.application.locale()).toEqual('swapped-locale');
                });

                it('then event listeners are notified of the new locale', function () {
                    expect(spy.setLocale).toHaveBeenCalledWith('swapped-locale');
                });
            });
        });

        it('locale event listeners are not notified when setting locale to an existing value', function () {
            var spy = jasmine.createSpyObj('spy', ['setLocale']);
            binarta.application.eventRegistry.add(spy);
            binarta.application.setLocale(undefined);
            expect(spy.setLocale).not.toHaveBeenCalled();
        });

        describe('locale for presentation', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpy('spy');
            });

            it('starts out undefined', function () {
                expect(binarta.application.localeForPresentation()).toBeUndefined();
            });

            it('can be set', function () {
                binarta.application.setLocaleForPresentation('en');
                expect(binarta.application.localeForPresentation()).toEqual('en');
            });

            describe('observe locale for presentation', function () {
                var observer;

                beforeEach(function () {
                    binarta.application.setLocaleForPresentation('en');
                    observer = binarta.application.observeLocaleForPresentation(spy)
                });

                it('immediately triggers listener with current locale for presentation', function () {
                    expect(spy).toHaveBeenCalledWith('en');
                });

                it('triggers listener with updates to the locale for presentation', function () {
                    binarta.application.setLocaleForPresentation('fr');
                    expect(spy).toHaveBeenCalledWith('fr');
                });

                it('listeners are not triggered when the locale for presentation is set to the existing value', function () {
                    binarta.application.setLocaleForPresentation('en');
                    expect(spy).toHaveBeenCalledTimes(1);
                });

                it('when disconnected listener receives no further updates', function () {
                    observer.disconnect();
                    binarta.application.setLocaleForPresentation('fr');
                    expect(spy).not.toHaveBeenCalledWith('fr');
                });
            });
        });

        describe('locale is determined based on primary language and locale for presentation', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpyObj('spy', ['applyLocale', 'unlocalized']);
                binarta.application.eventRegistry.add(spy);
                binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
            });

            it('given neither the primary language and the locale for presentation have been set yet then the locale is still undefined', function () {
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the primary language is set to undefined but the locale for presentation has not been set yet then the locale is still undefined', function () {
                setPrimaryLanguage(undefined);
                expect(binarta.application.locale()).toBeUndefined();
            });

            describe('given the primary language is set but the locale for presentation is set to unknown', function () {
                beforeEach(function () {
                    setPrimaryLanguage('en');
                    setLocaleForPresentation(undefined);
                });

                it('then default locale is used', function () {
                    expect(binarta.application.locale()).toEqual('default');
                });

                it('then use the primary language as locale for presentation', function () {
                    expect(binarta.application.localeForPresentation()).toEqual('en');
                });
            });

            it('given the locale for presentation is set to undefined but the primary language has not been set yet then the locale is still undefined', function () {
                setLocaleForPresentation(undefined);
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the locale for presentation is set but the primary language has not been set yet then the locale is still undefined', function () {
                setLocaleForPresentation('en');
                expect(binarta.application.locale()).toBeUndefined();
            });

            describe('given the locale for presentation is set but the primary language has been set to undefined', function () {
                beforeEach(function () {
                    setPrimaryLanguage(undefined);
                    setLocaleForPresentation('en');
                });

                it('then the locale is still undefined', function () {
                    expect(binarta.application.locale()).toBeUndefined();
                });

                it('then an unlocalized event is raised systems can hook into to try again and update the application state', function () {
                    expect(spy.unlocalized).toHaveBeenCalled();
                });
            });

            describe('given the locale for presentation is not supported', function () {
                beforeEach(function () {
                    setSupportedLanguages(['en', 'fr']);
                    setLocaleForPresentation('de');
                });

                it('then the locale remains undefined', function () {
                    expect(binarta.application.locale()).toBeUndefined();
                });

                it('then an apply locale event is raised systems can hook into to try again and update the application state', function () {
                    expect(spy.applyLocale).toHaveBeenCalledWith('en');
                });
            });

            it('given both the primary language and the locale for presentation are undefined then set the application locale to default', function () {
                setPrimaryLanguage(undefined);
                setLocaleForPresentation(undefined);
                expect(binarta.application.locale()).toEqual('default');
            });

            it('given the primary language and the external locale match then the locale is set to default', function () {
                setPrimaryLanguage('en');
                setLocaleForPresentation('en');
                expect(binarta.application.locale()).toEqual('default');
            });

            it('given the primary language and the external locale do not match then the locale is set to match the external locale', function () {
                setSupportedLanguages(['en', 'fr']);
                setLocaleForPresentation('fr');
                expect(binarta.application.locale()).toEqual('fr');
            });

            it('changing the locale for presentation updates the locale as well', function () {
                setSupportedLanguages(['en', 'fr']);
                setLocaleForPresentation('en');
                setLocaleForPresentation('fr');
                expect(binarta.application.locale()).toEqual('fr');
            });

            function setPrimaryLanguage(locale) {
                setSupportedLanguages(locale ? [locale] : [])
            }

            function setSupportedLanguages(languages) {
                if (languages.length > 0)
                    binarta.application.gateway.updateApplicationProfile({supportedLanguages: languages});
                binarta.application.refresh();
            }

            function setLocaleForPresentation(locale) {
                binarta.application.setLocaleForPresentation(locale);
            }
        });

        describe('adhesive reading', function () {
            describe('with locale', function () {
                beforeEach(function () {
                    binarta.application.setLocale('l');
                });

                it('read delegates to gateway', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.adhesiveReading.read();
                    expect(binarta.application.gateway.fetchAdhesiveSnapshotRequest).toEqual({
                        locale: 'l'
                    });
                });

                it('read uses locale for presentation if one is specified', function () {
                    binarta.application.setLocaleForPresentation('p');
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.adhesiveReading.read();
                    expect(binarta.application.gateway.fetchAdhesiveSnapshotRequest).toEqual({
                        locale: 'p'
                    });
                });

                it('read is triggered when locale is applied', function () {
                    binarta.application.gateway = new GatewaySpy();

                    binarta.application.setProfile({
                        supportedLanguages: ['en', 'nl']
                    });
                    binarta.application.setLocaleForPresentation('en');

                    expect(binarta.application.gateway.fetchAdhesiveSnapshotRequest).toEqual({
                        locale: 'en'
                    });
                });

                describe('without data handler', function () {
                    beforeEach(function () {
                        binarta.application.gateway = new ValidApplicationGateway();
                    });

                    it('read without data handler has no effect', function () {
                        binarta.application.adhesiveReading.read();
                    });
                });

                describe('with data handler', function () {
                    var cachedMsg, cachedTimestamp;

                    beforeEach(function () {
                        cachedMsg = undefined;
                        binarta.application.gateway = new ValidApplicationGateway();
                        binarta.application.adhesiveReading.handlers.add({
                            type: 't',
                            cache: function (it) {
                                cachedMsg = it.msg;
                                cachedTimestamp = it.timestamp;
                            }
                        });
                    });

                    it('read', function () {
                        binarta.application.adhesiveReading.read();
                        expect(cachedMsg).toEqual('Hello World!');
                        expect(cachedTimestamp).toEqual(moment('20170906155112645+02:00', 'YYYYMMDDHHmmssSSSZ').toDate());
                    });
                });

                describe('given multiple data handlers', function () {
                    var supportedHandler, notSupportedHandler;

                    beforeEach(function () {
                        supportedHandler = jasmine.createSpy('supported-handler');
                        notSupportedHandler = jasmine.createSpy('not-supported-handler');
                        binarta.application.gateway = new ValidApplicationGateway();
                        binarta.application.adhesiveReading.handlers.add({type: 't', cache: supportedHandler});
                        binarta.application.adhesiveReading.handlers.add({type: '-', cache: notSupportedHandler});
                    });

                    it('read only invokes supported handlers', function () {
                        binarta.application.adhesiveReading.read();
                        expect(supportedHandler).toHaveBeenCalled();
                        expect(notSupportedHandler).not.toHaveBeenCalled();
                    });
                });

                describe('when reading an already read snapshot', function () {
                    var handler;

                    beforeEach(function () {
                        handler = jasmine.createSpy('handler');

                        binarta.application.gateway = new ValidApplicationGateway();
                        binarta.application.adhesiveReading.handlers.add({type: 't', cache: handler});
                        binarta.application.adhesiveReading.read('-');
                    });

                    it('for another locale then read section again', function () {
                        binarta.application.setLocale('-');
                        binarta.application.gateway = new GatewaySpy();
                        binarta.application.adhesiveReading.read();
                        expect(binarta.application.gateway.fetchAdhesiveSnapshotRequest).toEqual({
                            locale: '-'
                        });
                    });
                });

                describe('event listening', function () {
                    var spy;

                    beforeEach(function () {
                        spy = jasmine.createSpyObj('spy', ['start', 'stop']);
                        binarta.application.adhesiveReading.eventRegistry.add(spy);
                        binarta.application.gateway = new DeferredApplicationGateway();
                    });

                    it('read generates start and stop events', function () {
                        binarta.application.adhesiveReading.read();

                        expect(spy.start).toHaveBeenCalled();
                        expect(spy.stop).not.toHaveBeenCalled();

                        binarta.application.gateway.continue();

                        expect(spy.stop).toHaveBeenCalled();
                    });

                    it('starting multiple reads generates only one start event', function () {
                        binarta.application.adhesiveReading.read();
                        binarta.application.adhesiveReading.read();
                        expect(spy.start).toHaveBeenCalledTimes(1);
                    });

                    it('stopping multiple reads generates only one stop event', function () {
                        binarta.application.adhesiveReading.read();
                        binarta.application.adhesiveReading.read();

                        binarta.application.gateway.continue();

                        expect(spy.stop).toHaveBeenCalledTimes(1);
                    });
                });
            });

            describe('job scheduling', function () {
                var job1, job2;

                beforeEach(function () {
                    job1 = jasmine.createSpy('-');
                    job2 = jasmine.createSpy('-');
                    binarta.schedule(job1);
                    binarta.schedule(job2);
                    binarta.application.gateway = new DeferredApplicationGateway();
                });

                it('on completion callback is not executed as long as adhesive reading does not complete', function () {
                    binarta.application.setLocale('l');
                    expect(job1).not.toHaveBeenCalled();
                    expect(job2).not.toHaveBeenCalled();
                });

                it('scheduled jobs are held internally while waiting for execution', function () {
                    expect(binarta.$scheduler.$jobs.length).toEqual(2);
                });

                describe('when adhesive reading completes', function () {
                    beforeEach(function () {
                        binarta.application.setLocale('l');
                        binarta.application.gateway.continue();
                    });

                    it('on completion callback of scheduled jobs execute', function () {
                        expect(job1).toHaveBeenCalled();
                        expect(job2).toHaveBeenCalled();
                    });

                    it('the internal cache of scheduled jobs is cleared', function () {
                        expect(binarta.$scheduler.$jobs.length).toEqual(0);
                    });

                    describe('jobs scheduled after completion', function () {
                        var additionalJob;

                        beforeEach(function () {
                            additionalJob = jasmine.createSpy('-');
                            binarta.schedule(additionalJob);
                        });

                        it('complete immediately', function () {
                            expect(additionalJob).toHaveBeenCalled();
                        });

                        it('do not grow the internal job cache', function () {
                            expect(binarta.$scheduler.$jobs.length).toEqual(0);
                        });
                    });
                });
            });
        });

        describe('config', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpy('spy');
            });

            describe('given empty cache', function () {
                var response;

                beforeEach(function () {
                    response = jasmine.createSpyObj('response', ['unauthenticated', 'forbidden', 'success']);
                });

                it('add public config invokes gateway', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.addPublic({key: 'k', value: 'v'});
                    expect(binarta.application.gateway.addConfigRequest).toEqual({
                        scope: 'public',
                        key: 'k',
                        value: 'v'
                    });
                });

                it('add system config invokes gateway', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.addSystem({key: 'k', value: 'v'});
                    expect(binarta.application.gateway.addConfigRequest).toEqual({
                        scope: 'system',
                        key: 'k',
                        value: 'v'
                    });
                });

                it('add public config requires authentication', function () {
                    binarta.application.gateway = new UnauthenticatedGateway();
                    binarta.application.config.addPublic({}, response);
                    expect(response.unauthenticated).toHaveBeenCalled();
                });

                it('add system config requires authentication', function () {
                    binarta.application.gateway = new UnauthenticatedGateway();
                    binarta.application.config.addSystem({}, response);
                    expect(response.unauthenticated).toHaveBeenCalled();
                });

                it('add public config requires permission', function () {
                    binarta.application.gateway = new MissingPermissionsGateway();
                    binarta.application.config.addPublic({}, response);
                    expect(response.forbidden).toHaveBeenCalled();
                });

                it('add system config requires permission', function () {
                    binarta.application.gateway = new MissingPermissionsGateway();
                    binarta.application.config.addSystem({}, response);
                    expect(response.forbidden).toHaveBeenCalled();
                });

                it('add public config calls success handler with the saved value', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.addPublic({key: 'k', value: 'v'}, response);
                    expect(response.success).toHaveBeenCalledWith('v');
                });

                it('add system config calls success handler with the saved value', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.addSystem({id: 'k', value: 'v'}, response);
                    expect(response.success).toHaveBeenCalledWith('v');
                });

                it('add public config updates session cache', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.addPublic({id: 'k', value: '-'});
                    expect(JSON.parse(sessionStorage.getItem('binarta:config:k'))).toEqual({
                        timestamp: moment(now).format('YYYYMMDDHHmmssSSSZ'),
                        value: '-'
                    });
                });

                it('add public config updates local cache', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.addPublic({id: 'k', value: '-'});
                    binarta.application.config.findPublic('k', response.success);
                    expect(response.success).toHaveBeenCalledWith('-');
                });

                it('find public config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.findPublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'k'});
                });

                it('find system config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.findSystem('k', spy);
                    expect(binarta.application.gateway.findConfigRequest).toEqual({scope: 'system', id: 'k'});
                });

                it('find unknown public config', function () {
                    binarta.application.gateway = new ConfigNotFoundApplicationGateway();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });

                it('find unknown system config', function () {
                    binarta.application.gateway = new ConfigNotFoundApplicationGateway();
                    binarta.application.config.findSystem('k', response);
                    expect(response.success).toHaveBeenCalledWith('');
                });

                it('find known public config', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('find known system config', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.findSystem('k', response);
                    expect(response.success).toHaveBeenCalledWith('v');
                });

                it('find known public config prefers session storage', function () {
                    sessionStorage.setItem('binarta:config:k', JSON.stringify({
                        timestamp: moment(now).format('YYYYMMDDHHmmssSSSZ'),
                        value: 'from-session-storage'
                    }));
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('from-session-storage');
                });

                it('find known public config prefers cached values when session storage is outdated', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.adhesiveReading.read();
                    sessionStorage.setItem('binarta:config:adhesive.config', JSON.stringify({
                        timestamp: moment('20170906155112645+02:00', 'YYYYMMDDHHmmssSSSZ').subtract(1, 's'),
                        value: 'from-session-storage'
                    }));
                    binarta.application.config.findPublic('adhesive.config', spy);
                    expect(spy).toHaveBeenCalledWith('from-adhesive-reading');
                });

                it('find known public config clears keys in session storage when they are outdated', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.adhesiveReading.read();
                    sessionStorage.setItem('binarta:config:adhesive.config', JSON.stringify({
                        timestamp: moment('20170906155112645+02:00', 'YYYYMMDDHHmmssSSSZ').subtract(1, 's'),
                        value: 'from-session-storage'
                    }));
                    binarta.application.config.findPublic('adhesive.config', spy);
                    expect(sessionStorage.getItem('binarta:config:adhesive.config')).toEqual(null);
                });

                it('find known system config ignores session storage', function () {
                    sessionStorage.setItem('binarta:config:k', JSON.stringify({
                        timestamp: moment(now).format('YYYYMMDDHHmmssSSSZ'),
                        value: 'from-session-storage'
                    }));
                    binarta.application.config.findSystem('k', response);
                    expect(response.success).toHaveBeenCalledWith('v');
                });

                it('observing public config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.observePublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'k'});
                });

                it('observing system config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.observeSystem('k', spy);
                    expect(binarta.application.gateway.findConfigRequest).toEqual({scope: 'system', id: 'k'});
                });

                it('observing known public config triggers on success handler', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.observePublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('observing known system config triggers on success handler', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.observeSystem('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('observing system config when unauthenticated triggers on success handler', function () {
                    binarta.application.gateway = new UnauthenticatedGateway();
                    binarta.application.config.observeSystem('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });

                it('observing system config with insufficient permissions triggers on success handler', function () {
                    binarta.application.gateway = new MissingPermissionsGateway();
                    binarta.application.config.observeSystem('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });

                it('observing when public config is modified', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.observePublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                    binarta.application.config.addPublic({id: 'k', value: 'v2'});
                    expect(spy).toHaveBeenCalledWith('v2');
                });

                it('public observers receives value from session storage when an older version is being cached', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.observePublic('k', spy);
                    binarta.application.config.addPublic({id: 'k', value: 'v2'});
                    binarta.application.config.cache('k', 'v3', moment(now).subtract(1, 's'));
                    expect(spy).toHaveBeenCalledWith('v');
                    expect(spy).toHaveBeenCalledWith('v2');
                    expect(spy).not.toHaveBeenCalledWith('v3');
                });
            });

            describe('given populated cache through public config lookups', function () {
                beforeEach(function () {
                    binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
                    binarta.application.gateway.addPublicConfig({id: 'k', value: 'v'});
                    binarta.application.config.findPublic('k', function () {
                    });
                    binarta.application.gateway = new GatewaySpy();
                });

                it('then repeated public config lookups do not go to the gateway anymore', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toBeUndefined();
                });

                it('then public config lookup for a non cached key invokes gateway', function () {
                    binarta.application.config.findPublic('x', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'x'});
                });

                it('then public config lookup for a cached key returns the cached value', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('clear cache', function () {
                    binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
                    binarta.application.config.clear();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });

                it('then observing public config does not go to the gateway anymore', function () {
                    binarta.application.config.observePublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toBeUndefined();
                });
            });

            describe('given cache populated through adhesive reading', function () {
                beforeEach(function () {
                    binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
                    binarta.application.gateway.addSectionData({type: 'config', key: 'k', value: 'v'});

                    binarta.application.adhesiveReading.read();

                    binarta.application.gateway = new GatewaySpy();
                });

                it('then public config lookups for the cached key do not go to the gateway anymore', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toBeUndefined();
                });

                it('then public config lookup for a non cached key invokes gateway', function () {
                    binarta.application.config.findPublic('x', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'x'});
                });

                it('then public config lookup for the cached key returns the cached value', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('clear cache', function () {
                    binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
                    binarta.application.config.clear();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });
            });

            describe('given cache populated through add cache record hook', function () {
                beforeEach(function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.cache('k', 'v');
                });

                it('then public config lookups for the cached key do not go to the gateway anymore', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toBeUndefined();
                });

                it('then public config lookup for a non cached key invokes gateway', function () {
                    binarta.application.config.findPublic('x', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'x'});
                });

                it('then public config lookup for the cached key returns the cached value', function () {
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('clear cache', function () {
                    binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
                    binarta.application.config.clear();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });
            });

            it('find public config resolves an empty string from cache', function () {
                binarta.application.gateway = new GatewaySpy();
                binarta.application.config.cache('k', '');
                binarta.application.config.findPublic('k', spy);
                expect(spy).toHaveBeenCalledWith('');
            });

            it('when observing public config and cache is updated then observers are invoked', function () {
                binarta.application.config.observePublic('k', spy);
                expect(spy).toHaveBeenCalledWith('v');
                binarta.application.config.cache('k', 'v2');
                expect(spy).toHaveBeenCalledWith('v2');
            });

            it('when disconnecting public config observer and cache is updated then on success handler is no longer invoked', function () {
                var observer = binarta.application.config.observePublic('k', spy);
                observer.disconnect();
                binarta.application.config.cache('k', 'v2');
                expect(spy).not.toHaveBeenCalledWith('v2');
            });

            it('when observing public config and is previously cached then observers are invoked', function () {
                binarta.application.config.cache('k', 'v');
                binarta.application.config.observePublic('k', spy);
                expect(spy).toHaveBeenCalledWith('v');
            });
        });

        describe('cookies', function () {
            describe('permission', function () {
                it('status is automatically evaluated', function () {
                    expect(binarta.application.cookies.permission.status).toBeDefined();
                });

                it('when local storage is disabled then expose permission storage disabled status', function () {
                    localStorage.removeItem('storageAvailable');
                    binarta.application.cookies.permission.evaluate();
                    expect(binarta.application.cookies.permission.status).toEqual('permission-storage-disabled');
                });

                describe('when local storage is enabled', function () {
                    it('then expose permission required status', function () {
                        binarta.application.cookies.permission.evaluate();
                        expect(binarta.application.cookies.permission.status).toEqual('permission-required');
                    });

                    it('when granting cookie permission then expose permission granted status', function () {
                        binarta.application.cookies.permission.grant();
                        expect(binarta.application.cookies.permission.status).toEqual('permission-granted');
                    });

                    it('when granting cookie permission then invoke grant listeners', function () {
                        var spy = jasmine.createSpyObj('spy', ['granted']);
                        binarta.application.cookies.permission.eventRegistry.observe(spy);
                        binarta.application.cookies.permission.grant();
                        expect(spy.granted).toHaveBeenCalled();
                    });

                    it('when local storage indicates permission was granted then expose permission granted status', function () {
                        localStorage.cookiesAccepted = 'true';
                        binarta.application.cookies.permission.evaluate();
                        expect(binarta.application.cookies.permission.status).toEqual('permission-granted');
                    });

                    it('when revoking cookie permission then expose permission revoked status', function () {
                        binarta.application.cookies.permission.revoke();
                        expect(binarta.application.cookies.permission.status).toEqual('permission-revoked');
                    });

                    it('when local storage indicates permission was revoked then expose permission revoked status', function () {
                        localStorage.cookiesAccepted = 'false';
                        binarta.application.cookies.permission.evaluate();
                        expect(binarta.application.cookies.permission.status).toEqual('permission-revoked');
                    });

                    it('when user agent is black listed', function () {
                        binarta.application.cookies.permission.blacklist = ['a', 'b', 'rt'];

                        ['a', 'b', 'partial'].forEach(function (it) {
                            window.navigator = {userAgent: it};
                            binarta.application.cookies.permission.evaluate();
                            expect(binarta.application.cookies.permission.status).toEqual('permission-granted');
                        });

                        ['x', 'FireFox', 'Chrome', 'Internet Explorer'].forEach(function (it) {
                            window.navigator = {userAgent: it};
                            binarta.application.cookies.permission.evaluate();
                            expect(binarta.application.cookies.permission.status).toEqual('permission-required');
                        });
                    });
                });
            });
        });

        describe('application lock', function () {
            var spy;

            beforeEach(function () {
                spy = jasmine.createSpyObj('listener', ['editing', 'viewing']);
            });

            it('application lock is initially open', function () {
                expect(binarta.application.lock.status).toEqual('open');
            });

            it('reserving the application lock', function () {
                binarta.application.lock.reserve();
                expect(binarta.application.lock.status).toEqual('closed');
            });

            it('observe reserving the application lock', function () {
                binarta.application.eventRegistry.observe(spy);
                binarta.application.lock.reserve();
                expect(spy.editing).toHaveBeenCalled();
            });

            it('releasing the application lock', function () {
                binarta.application.lock.reserve();
                binarta.application.lock.release();
                expect(binarta.application.lock.status).toEqual('open');
            });

            it('observe releasing the application lock', function () {
                binarta.application.eventRegistry.observe(spy);
                binarta.application.lock.reserve();
                binarta.application.lock.release();
                expect(spy.viewing).toHaveBeenCalled();
            });
        });

        describe('display settings', function () {
            var ui, observer;

            beforeEach(function () {
                ui = jasmine.createSpyObj('ui', ['attributes', 'working', 'saved', 'rejected']);
            });

            afterEach(function () {
                if (observer)
                    observer.disconnect();
            });

            describe('when selecting a component', function () {
                var component;

                beforeEach(function () {
                    component = binarta.application.display.settings.component('component');
                });

                it('multiple requests with the same id get the same instance', function () {
                    expect(binarta.application.display.settings.component('component')).toEqual(component);
                });

                describe('when selecting a widget', function () {
                    var widget;

                    beforeEach(function () {
                        widget = component.widget('widget');
                    });

                    it('multiple requests with the same id get the same instance', function () {
                        expect(component.widget('widget')).toEqual(widget);
                    });

                    describe('installing an observer', function () {
                        beforeEach(function () {
                            binarta.application.gateway = new GatewaySpy();
                            observer = widget.observe(ui);
                        });

                        it('loads default attributes from server', function () {
                            expect(binarta.application.gateway.getWidgetAttributesRequest).toEqual({
                                component: 'component',
                                widget: 'widget'
                            });
                        });

                        it('notifies observer of working status', function () {
                            expect(ui.working).toHaveBeenCalled();
                        });
                    });

                    it('observers receive the default attributes', function () {
                        observer = widget.observe(ui);
                        expect(ui.attributes).toHaveBeenCalledWith({
                            aspectRatio: {width: 3, height: 2},
                            fittingRule: 'contain'
                        });
                    });

                    it('disconnected observers are not notified of the default attributes', function () {
                        binarta.application.gateway = new GatewaySpy();
                        observer = widget.observe(ui);
                        observer.disconnect();
                        binarta.application.gateway = new ValidApplicationGateway();
                        widget.refresh();
                        expect(ui.attributes).not.toHaveBeenCalled();
                    });

                    it('installing additional observers reuses previously loaded attributes', function () {
                        observer = widget.observe(ui);
                        binarta.application.gateway = {};
                        ui.attributes.calls.reset();
                        observer = widget.observe(ui).disconnect();
                        expect(ui.attributes).toHaveBeenCalledWith({
                            aspectRatio: {width: 3, height: 2},
                            fittingRule: 'contain'
                        });
                    });

                    describe('when saving new default attributes', function () {
                        beforeEach(function () {
                            observer = widget.observe(ui);
                            binarta.application.gateway = new GatewaySpy();
                            widget.save('attributes');
                        });

                        it('then request is sent to server', function () {
                            expect(binarta.application.gateway.saveWidgetAttributesRequest).toEqual({
                                component: 'component',
                                widget: 'widget',
                                attributes: 'attributes'
                            });
                        });

                        it('then observer is notified of working status', function () {
                            expect(ui.working).toHaveBeenCalled();
                        });
                    });

                    describe('when saving new default attributes', function () {
                        beforeEach(function () {
                            observer = widget.observe(ui);
                            widget.save('attributes');
                        });

                        it('then the observer receives the updated attributes', function () {
                            expect(ui.attributes).toHaveBeenCalledWith('attributes');
                        });

                        it('then additional observers receive the updated attributes', function () {
                            ui.attributes.calls.reset();
                            observer = widget.observe(ui).disconnect();
                            expect(ui.attributes).toHaveBeenCalledWith('attributes');
                        });

                        it('then the observer is notified of save completion', function () {
                            expect(ui.saved).toHaveBeenCalled();
                        });
                    });

                    it('when saving invalid attributes then rejection report is sent to observers', function () {
                        observer = widget.observe(ui);
                        binarta.application.gateway = new InvalidApplicationGateway();
                        widget.save('-');
                        expect(ui.rejected).toHaveBeenCalledWith('report');
                    });

                    it('refreshing before atributes could be loaded from server does not trigger additional lookups', function () {
                        binarta.application.gateway = new GatewaySpy();
                        widget.refresh();
                        binarta.application.gateway = {};
                        widget.refresh();
                    });

                    it('refreshing after attributes could be loaded performs lookup from server', function () {
                        widget.refresh();
                        binarta.application.gateway = new GatewaySpy();
                        widget.refresh();
                        expect(binarta.application.gateway.getWidgetAttributesRequest).toEqual({
                            component: 'component',
                            widget: 'widget'
                        });
                    });
                });
            });
        });

        describe('dns', function () {
            var ui, db, observer;

            beforeEach(function () {
                ui = jasmine.createSpyObj('ui', ['status', 'disabled', 'records', 'rejected']);
                db = jasmine.createSpyObj('db', ['getCustomDomainRecords', 'saveCustomDomainRecords']);
                binarta.application.gateway = db;
            });

            it('does not yet load custom domain records from server', function () {
                expect(db.getCustomDomainRecords).not.toHaveBeenCalled();
            });

            describe('with observer', function () {
                beforeEach(function () {
                    observer = binarta.application.dns.observe(ui);
                });

                afterEach(function () {
                    observer.disconnect();
                });

                it('loads custom domain records from server', function () {
                    expect(db.getCustomDomainRecords).toHaveBeenCalled();
                });

                describe('when custom domain records are not supported', function () {
                    beforeEach(function () {
                        db.getCustomDomainRecords.calls.mostRecent().args[0].forbidden();
                    });

                    it('notify observers the feature is disabled', function () {
                        expect(ui.disabled).toHaveBeenCalled();
                    });

                    it('notify additional observers the feature is disabled', function () {
                        ui.disabled.calls.reset();
                        binarta.application.dns.observe(ui).disconnect();
                        expect(ui.disabled).toHaveBeenCalled();
                    });
                });

                describe('when custom domain records are supported', function () {
                    var records;

                    beforeEach(function () {
                        records = [
                            {name: '', type: 'A', values: ['a']},
                            {name: 'x', type: 'TXT', values: ['b']},
                            {name: 'y', type: 'CNAME', values: ['c']}
                        ];
                        db.getCustomDomainRecords.calls.mostRecent().args[0].success(records);
                    });

                    it('notify observers of the found records', function () {
                        expect(ui.records).toHaveBeenCalledWith([
                            {id: 0, name: '', type: 'A', values: ['a']},
                            {id: 1, name: 'x', type: 'TXT', values: ['b']},
                            {id: 2, name: 'y', type: 'CNAME', values: ['c']}
                        ]);
                    });

                    it('notify additional observers of the found records', function () {
                        ui.records.calls.reset();
                        binarta.application.dns.observe(ui).disconnect();
                        expect(ui.records).toHaveBeenCalledWith(records);
                    });

                    it('on refresh load custom domain records from server', function () {
                        db.getCustomDomainRecords.calls.reset();
                        binarta.application.dns.refresh();
                        expect(db.getCustomDomainRecords).toHaveBeenCalled();
                    });

                    describe('when saving custom domain records', function () {
                        beforeEach(function () {
                            records = ['x', 'y', 'z'];
                            binarta.application.dns.save(records);
                        });

                        it('perform server call', function () {
                            expect(db.saveCustomDomainRecords).toHaveBeenCalledWith(records, jasmine.any(Object));
                        });

                        describe('is success', function () {
                            beforeEach(function () {
                                db.saveCustomDomainRecords.calls.mostRecent().args[1].success();
                            });

                            it('notify observer with saved records', function () {
                                expect(ui.records).toHaveBeenCalledWith(records);
                            });

                            it('additional obervers are notified of the previously saved records', function () {
                                ui.records.calls.reset();
                                binarta.application.dns.observe(ui).disconnect();
                                expect(ui.records).toHaveBeenCalledWith(records);
                            });
                        });
                    });
                });
            });
        });
    });

    function UI() {
    }
})();
