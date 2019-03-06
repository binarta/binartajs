(function () {
    describe('binartajs', function () {
        var factory, ui;

        beforeEach(function () {
            ui = new UI();
            factory = new BinartajsFactory();
            factory.addUI(ui);
        });

        it('construct the application facade', function () {
            expect(factory.create()).toBeDefined();
        });

        it('subsystems are exposed on the application facade', function () {
            factory.addSubSystems({greeter: new SynchronousGreeter()});
            expect(factory.create().greeter.sayHello("World")).toEqual("Hello World!");
        });

        it('subsystems can interact with the wired ui', function () {
            factory.addSubSystems({greeter: new AsynchronousGreeter()});
            factory.create().greeter.sayHello("World");
            expect(ui.receivedGreeting).toEqual("Hello World!");
        });
    });

    describe('binartarx', function () {
        var registry, spy1, spy2, spyUnsupportedEvent;

        beforeEach(function () {
            registry = new BinartaRX();

            spy1 = jasmine.createSpyObj('spy1', ['on']);
            spy2 = jasmine.createSpyObj('spy2', ['on']);
            spyUnsupportedEvent = jasmine.createSpyObj('spy-unsupported-event', ['notSupported']);
        });

        it('register and invoke listeners', function () {
            registry.add(spy1);
            registry.add(spy2);

            registry.forEach(function (l) {
                l.on('ctx');
            });

            expect(spy1.on).toHaveBeenCalledWith('ctx');
            expect(spy2.on).toHaveBeenCalledWith('ctx');
        });

        it('support notify for raising events', function () {
            registry.add(spy1);

            registry.forEach(function (l) {
                l.notify('on', 'ctx');
            });

            expect(spy1.on).toHaveBeenCalledWith('ctx');
        });

        it('register and invoke listeners using the observe factory method', function () {
            registry.observe(spy1);
            registry.observe(spy2);

            registry.forEach(function (l) {
                l.on('ctx');
            });

            expect(spy1.on).toHaveBeenCalledWith('ctx');
            expect(spy2.on).toHaveBeenCalledWith('ctx');
        });

        it('listeners which do not suport the event are not notified', function () {
            registry.add(spyUnsupportedEvent);

            registry.forEach(function (l) {
                l.notify('on', 'ctx');
            });
        });

        it('deregister listeners', function () {
            registry.add(spy1);
            registry.remove(spy1);

            registry.forEach(function (l) {
                l.on();
            });

            expect(spy1.on).not.toHaveBeenCalled();
        });

        it('disconnected observes are not notified', function () {
            var observer = registry.observe(spy1);
            observer.disconnect();

            registry.forEach(function (l) {
                l.on();
            });

            expect(spy1.on).not.toHaveBeenCalled();
        });

        it('deregistering unknown listeners has no effect', function () {
            registry.add(spy1);
            registry.remove(spy2);

            registry.forEach(function (l) {
                l.on();
            });

            expect(spy1.on).toHaveBeenCalled();
            expect(spy2.on).not.toHaveBeenCalled();
        });

        it('deregistering listeners while events are being raised', function () {
            var deregisteringListener = new function () {
                var self = this;

                this.on = function () {
                    registry.remove(self);
                }
            };

            registry.add(deregisteringListener);
            registry.add(spy1);

            registry.forEach(function (l) {
                l.on();
            });

            expect(spy1.on).toHaveBeenCalled();
        });

        it('isEmpty exposes if any listeners are installed or not', function () {
            expect(registry.isEmpty()).toBeTruthy();
            registry.add(spy1);
            expect(registry.isEmpty()).toBeFalsy();
            registry.remove(spy1);
            expect(registry.isEmpty()).toBeTruthy();
        });

        it('should do stuff', function () {
            registry.add(spy1);
            registry.add(spy2);

            registry.notify('on', 'ctx');

            expect(spy1.on).toHaveBeenCalledWith('ctx');
            expect(spy2.on).toHaveBeenCalledWith('ctx');
        });

        it('should be possible to register conditional observers', function () {
            registry.observeIf(function (ctx) {
                return ctx === 'ctx'
            }, spy1);
            registry.observeIf(function (ctx) {
                return ctx !== 'ctx'
            }, spy2);

            registry.notify('on', 'ctx');

            expect(spy1.on).toHaveBeenCalledWith('ctx');
            expect(spy2.on).not.toHaveBeenCalled();
        })
    });

    describe('BinartaWidget', function () {
        var widget, extension, ui, observer;

        beforeEach(function () {
            extension = jasmine.createSpyObj('extension', ['refresh', 'onNewObserver']);
            widget = BinartaWidget(function (rx, response) {
                var widget = this;

                widget.rx = rx;
                widget.toResponseHandler = response;
                widget.refresh = extension.refresh;
                widget.onNewObserver = extension.onNewObserver;
            });
            ui = jasmine.createSpyObj('ui', ['status', 'rejected', 'customEvent']);
        });

        it('refresh is not yet requested', function () {
            expect(extension.refresh).not.toHaveBeenCalled();
        });

        describe('when installing an observer', function () {
            beforeEach(function () {
                observer = widget.observe(ui);
            });

            afterEach(function () {
                observer.disconnect();
            });

            it('observers are immediately notified of the current idle status', function () {
                expect(ui.status).toHaveBeenCalledWith('idle');
            });

            it('refresh is requested', function () {
                expect(extension.refresh).toHaveBeenCalled();
            });

            it('onNewObserver is called', function () {
                expect(extension.onNewObserver).toHaveBeenCalled();
            });

            it('the extension can raise custom events to observers', function () {
                widget.rx.notify('customEvent', 'Hello World!');
                expect(ui.customEvent).toHaveBeenCalledWith('Hello World!');
            });

            describe('the extension can enable working status with the given response handler factory', function () {
                var response, worker;

                beforeEach(function () {
                    ui.status.calls.reset();
                    worker = jasmine.createSpyObj('worker', ['success']);
                    response = widget.toResponseHandler(worker);
                });

                it('observers are notified of the new working status', function () {
                    expect(ui.status).toHaveBeenCalledWith('working');
                });

                it('given success handler is not yet executed', function () {
                    expect(worker.success).not.toHaveBeenCalled();
                });

                it('observers are not yet notified of a violation report', function () {
                    expect(ui.rejected).not.toHaveBeenCalled();
                });

                describe('on success', function () {
                    beforeEach(function () {
                        response.success('a', 'b');
                    });

                    it('return to idle status', function () {
                        expect(ui.status).toHaveBeenCalledWith('idle');
                    });

                    it('given success handler is executed', function () {
                        expect(worker.success).toHaveBeenCalledWith('a', 'b');
                    });
                });

                describe('on rejected', function() {
                    beforeEach(function () {
                        response.rejected('violation-report');
                    });

                    it('observers are notified the request was rejected', function () {
                        expect(ui.status).toHaveBeenCalledWith('rejected');
                    });

                    it('observers receive the violation report', function () {
                        expect(ui.rejected).toHaveBeenCalledWith('violation-report');
                    });
                });
            });

            describe('installing additional observers', function () {
                var secondObserver;

                beforeEach(function () {
                    ui.status.calls.reset();
                    extension.refresh.calls.reset();
                    extension.onNewObserver.calls.reset();
                    secondObserver = widget.observe(ui);
                });

                afterEach(function () {
                    secondObserver.disconnect();
                });

                it('additional observer is also notified of current idle status', function () {
                    expect(ui.status).toHaveBeenCalledWith('idle');
                });

                it('refresh is not requested again', function () {
                    expect(extension.refresh).not.toHaveBeenCalled();
                });

                it('onNewObserver is called again', function () {
                    expect(extension.onNewObserver).toHaveBeenCalled();
                });
            });
        });
    });

    function UI() {
        this.showGreeting = function (greeting) {
            this.receivedGreeting = greeting;
        }
    }

    function SynchronousGreeter() {
        this.sayHello = function (who) {
            return "Hello " + who + "!";
        }
    }

    function AsynchronousGreeter() {
        this.sayHello = function (who) {
            this.ui.showGreeting("Hello " + who + "!");
        }
    }
})();