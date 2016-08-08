(function () {
    describe('binarta-applicationjs', function () {
        var binarta, ui;

        beforeEach(function() {
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

        it('on refresh request profile data', function () {
            binarta.application.gateway = new GatewaySpy();
            binarta.application.refresh();
            expect(binarta.application.gateway.fetchApplicationProfileRequest).toEqual({});
        });

        it('when refresh success then profile cache is updated', function () {
            binarta.application.gateway = new ValidApplicationGateway();
            binarta.application.refresh();
            expect(binarta.application.profile().name).toEqual('test-application');
        });

        describe('when passing an optional success listener to refresh', function() {
            var spy;

            beforeEach(function() {
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
                beforeEach(function () {
                    binarta.application.setLocale('swapped-locale');
                });

                it('then locale is saved in local storage', function () {
                    expect(localStorage.locale).toEqual('swapped-locale');
                });

                it('then locale is saved in session storage', function () {
                    expect(sessionStorage.locale).toEqual('swapped-locale');
                });

                it('then locale resolves without refresh', function() {
                    expect(binarta.application.locale()).toEqual('swapped-locale');
                });
            });
        });
    });

    function UI() {
    }
})();