(function () {
    describe('binarta-applicationjs', function () {
        var binarta, ui;

        beforeEach(function () {
            localStorage.removeItem('locale');
            sessionStorage.removeItem('locale');
        });
        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({application: new BinartaApplicationjs()});
            binarta = factory.create();

            binarta.application.gateway = new ValidApplicationGateway();
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

            it('and refresh events then listeners receive a set primary language event', function() {
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

        describe('locale resolution', function () {
            it('starts out undefined', function () {
                expect(binarta.application.locale()).toBeUndefined();
            });

            describe('when locale is specified in local storage', function () {
                beforeEach(function () {
                    localStorage.locale = 'from-local-storage';
                    binarta.application.refresh();
                });

                it('then resolve language from local storage', function () {
                    expect(binarta.application.locale()).toEqual('from-local-storage');
                });

                describe('and locale is specified in session storage', function () {
                    beforeEach(function () {
                        sessionStorage.locale = 'from-session-storage';
                        binarta.application.refresh();
                    });

                    it('then resolves from session storage', function () {
                        expect(binarta.application.locale()).toEqual('from-session-storage');
                    });

                    describe('and session storage is cleared', function () {
                        beforeEach(function () {
                            sessionStorage.removeItem('locale');
                            binarta.application.refresh();
                        });

                        it('then resolves from local storage', function () {
                            expect(binarta.application.locale()).toEqual('from-local-storage');
                        });
                    });

                    describe('and has previously been resolved', function () {
                        beforeEach(function () {
                            sessionStorage.locale = 'from-memory';
                            binarta.application.refresh();
                        });

                        describe('and session storage and local storage are cleared', function () {
                            beforeEach(function () {
                                delete sessionStorage.locale;
                                delete localStorage.locale;
                            });

                            it('then resolves to remembered locale', function () {
                                expect(binarta.application.locale()).toEqual('from-memory');
                            });
                        });
                    });
                });

                it('then local storage locale is promoted to session storage locale', function () {
                    expect(sessionStorage.locale).toEqual(localStorage.locale);
                });
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

                it('then locale is saved in session storage', function () {
                    expect(sessionStorage.locale).toEqual('swapped-locale');
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

        describe('locale for presentation', function() {
            var spy;

            beforeEach(function() {
                spy = jasmine.createSpy('spy');
            });

            it('starts out undefined', function() {
                expect(binarta.application.localeForPresentation()).toBeUndefined();
            });

            it('can be set', function() {
                binarta.application.setLocaleForPresentation('en');
                expect(binarta.application.localeForPresentation()).toEqual('en');
            });

            describe('observe locale for presentation', function() {
                var observer;

                beforeEach(function() {
                    binarta.application.setLocaleForPresentation('en');
                    observer = binarta.application.observeLocaleForPresentation(spy)
                });

                it('immediately triggers listener with current locale for presentation', function() {
                    expect(spy).toHaveBeenCalledWith('en');
                });

                it('triggers listener with updates to the locale for presentation', function() {
                    binarta.application.setLocaleForPresentation('fr');
                    expect(spy).toHaveBeenCalledWith('fr');
                });

                it('listeners are not triggered when the locale for presentation is set to the existing value', function() {
                    binarta.application.setLocaleForPresentation('en');
                    expect(spy).toHaveBeenCalledTimes(1);
                });

                it('when disconnected listener receives no further updates', function() {
                    observer.disconnect();
                    binarta.application.setLocaleForPresentation('fr');
                    expect(spy).not.toHaveBeenCalledWith('fr');
                });
            });
        });

        describe('locale is determined based on primary language and locale for presentation', function () {
            beforeEach(function () {
                binarta.application.gateway = new BinartaInMemoryGatewaysjs().application;
            });

            it('given neither the primary language and the locale for presentation have been set yet then the locale is still undefined', function () {
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the primary language is set to undefined but the locale for presentation has not been set yet then the locale is still undefined', function () {
                setPrimaryLanguage(undefined);
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the primary language is set but the locale for presentation has not been set yet then the locale is still undefined', function () {
                setPrimaryLanguage('en');
                setLocaleForPresentation(undefined);
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the locale for presentation is set to undefined but the primary language has not been set yet then the locale is still undefined', function () {
                setLocaleForPresentation(undefined);
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the locale for presentation is set but the primary language has not been set yet then the locale is still undefined', function () {
                setLocaleForPresentation('en');
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the locale for presentation is set but the primary language has been set to undefined then the locale is still undefined', function () {
                setPrimaryLanguage(undefined);
                setLocaleForPresentation('en');
                expect(binarta.application.locale()).toBeUndefined();
            });

            it('given the locale for presentation is not supported then the locale remains undefined', function () {
                setSupportedLanguages(['en', 'fr']);
                setLocaleForPresentation('de');
                expect(binarta.application.locale()).toBeUndefined();
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
            beforeEach(function () {
                binarta.application.setLocale('l');
            });

            it('read section delegates to gateway', function () {
                binarta.application.gateway = new GatewaySpy();
                binarta.application.adhesiveReading.read('s');
                expect(binarta.application.gateway.fetchSectionDataRequest).toEqual({
                    id: 's',
                    locale: 'l'
                });
            });

            it('read section without data handler has no effect', function () {
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.adhesiveReading.read('-');
            });

            it('read section with data handler', function () {
                var cachedMsg;

                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.adhesiveReading.handlers.add({
                    type: 't',
                    cache: function (it) {
                        cachedMsg = it.msg;
                    }
                });
                binarta.application.adhesiveReading.read('-');

                expect(cachedMsg).toEqual('Hello World!');
            });

            it('read section only invokes supported handlers', function () {
                var supportedHandler = jasmine.createSpy('supported-handler');
                var notSupportedHandler = jasmine.createSpy('not-supported-handler');

                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.adhesiveReading.handlers.add({type: 't', cache: supportedHandler});
                binarta.application.adhesiveReading.handlers.add({type: '-', cache: notSupportedHandler});
                binarta.application.adhesiveReading.read('-');

                expect(supportedHandler).toHaveBeenCalled();
                expect(notSupportedHandler).not.toHaveBeenCalled();
            });

            describe('when reading an already read section', function () {
                var handler;

                beforeEach(function () {
                    handler = jasmine.createSpy('handler');

                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.adhesiveReading.handlers.add({type: 't', cache: handler});
                    binarta.application.adhesiveReading.read('-');
                });

                it('then do nothing', function () {
                    binarta.application.adhesiveReading.read('-');
                    expect(handler).toHaveBeenCalledTimes(1);
                });

                it('for another locale then read section again', function () {
                    binarta.application.setLocale('-');
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.adhesiveReading.read('-');
                    expect(binarta.application.gateway.fetchSectionDataRequest).toEqual({
                        id: '-',
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

                it('generates start and stop events', function () {
                    binarta.application.adhesiveReading.read('-');

                    expect(spy.start).toHaveBeenCalled();
                    expect(spy.stop).not.toHaveBeenCalled();

                    binarta.application.gateway.continue();

                    expect(spy.stop).toHaveBeenCalled();
                });

                it('starting multiple reads generates only one start event', function () {
                    binarta.application.adhesiveReading.read('a');
                    binarta.application.adhesiveReading.read('b');
                    expect(spy.start).toHaveBeenCalledTimes(1);
                });

                it('stopping multiple reads generates only one stop event', function () {
                    binarta.application.adhesiveReading.read('a');
                    binarta.application.adhesiveReading.read('b');

                    binarta.application.gateway.continue();

                    expect(spy.stop).toHaveBeenCalledTimes(1);
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
                    binarta.application.adhesiveReading.read('-');
                    expect(job1).not.toHaveBeenCalled();
                    expect(job2).not.toHaveBeenCalled();
                });

                it('scheduled jobs are held internally while waiting for execution', function () {
                    expect(binarta.$scheduler.$jobs.length).toEqual(2);
                });

                describe('when adhesive reading completes', function () {
                    beforeEach(function () {
                        binarta.application.adhesiveReading.read('-');
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
                it('find public config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.findPublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'k'});
                });

                it('find unknown config', function () {
                    binarta.application.gateway = new ConfigNotFoundApplicationGateway();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('');
                });

                it('find known config', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.findPublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
                });

                it('observing public config invokes gateway for lookup', function () {
                    binarta.application.gateway = new GatewaySpy();
                    binarta.application.config.observePublic('k', spy);
                    expect(binarta.application.gateway.findPublicConfigRequest).toEqual({id: 'k'});
                });

                it('observing known public config triggers on success handler', function () {
                    binarta.application.gateway = new ValidApplicationGateway();
                    binarta.application.config.observePublic('k', spy);
                    expect(spy).toHaveBeenCalledWith('v');
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

                    binarta.application.adhesiveReading.read('-');

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

            it('when disconnecting public config observer and cache is updated then on success handler is no longer are invoked', function () {
                binarta.application.config.observePublic('k', spy);
                expect(spy).toHaveBeenCalledWith('v');
                binarta.application.config.cache('k', 'v2');
                expect(spy).toHaveBeenCalledWith('v2');
            });
        });
    });

    function UI() {
    }
})();