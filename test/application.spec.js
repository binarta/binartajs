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

        it('exposes an empty list of supported languages', function() {
            expect(binarta.application.supportedLanguages()).toEqual([]);
        });

        it('on refresh request profile data', function () {
            binarta.application.gateway = new GatewaySpy();
            binarta.application.refresh();
            expect(binarta.application.gateway.fetchApplicationProfileRequest).toEqual({});
        });

        describe('when refresh success', function() {
            beforeEach(function() {
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.refresh();
            });

            it('then profile cache is updated', function () {
                expect(binarta.application.profile().name).toEqual('test-application');
            });

            it('then expose supported languages', function() {
                expect(binarta.application.supportedLanguages()).toEqual(['en', 'nl']);
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

                it('then event listeners are notified of the new locale', function() {
                    expect(spy.setLocale).toHaveBeenCalledWith('swapped-locale');
                });
            });
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

            it('read section does nothing when a section has already been read', function () {
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

            it('read section does nothing when reading an already read section', function () {
                var handler = jasmine.createSpy('handler');

                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.adhesiveReading.handlers.add({type: 't', cache: handler});
                binarta.application.adhesiveReading.read('-');
                binarta.application.adhesiveReading.read('-');

                expect(handler).toHaveBeenCalledTimes(1);
            });

            describe('event listening', function() {
                var spy;

                beforeEach(function() {
                    spy = jasmine.createSpyObj('spy', ['start', 'stop']);
                    binarta.application.adhesiveReading.eventRegistry.add(spy);
                    binarta.application.gateway = new DeferredApplicationGateway();
                });

                it('generates start and stop events', function() {
                    binarta.application.adhesiveReading.read('-');

                    expect(spy.start).toHaveBeenCalled();
                    expect(spy.stop).not.toHaveBeenCalled();

                    binarta.application.gateway.continue();

                    expect(spy.stop).toHaveBeenCalled();
                });

                it('starting multiple reads generates only one start event', function() {
                    binarta.application.adhesiveReading.read('a');
                    binarta.application.adhesiveReading.read('b');
                    expect(spy.start).toHaveBeenCalledTimes(1);
                });

                it('stopping multiple reads generates only one stop event', function() {
                    binarta.application.adhesiveReading.read('a');
                    binarta.application.adhesiveReading.read('b');

                    binarta.application.gateway.continue();

                    expect(spy.stop).toHaveBeenCalledTimes(1);
                });
            });
        });
    });

    function UI() {
    }
})();