(function() {
    describe('binartajs', function() {
        var factory, ui;

        beforeEach(function() {
            ui = new UI();
            factory = new BinartajsFactory();
            factory.addUI(ui);
        });

        it('construct the application facade', function() {
            expect(factory.create()).toBeDefined();
        });

        it('subsystems are exposed on the application facade', function() {
            factory.addSubSystems({greeter:new SynchronousGreeter()});
            expect(factory.create().greeter.sayHello("World")).toEqual("Hello World!");
        });

        it('subsystems can interact with the wired ui', function() {
            factory.addSubSystems({greeter:new AsynchronousGreeter()});
            factory.create().greeter.sayHello("World");
            expect(ui.receivedGreeting).toEqual("Hello World!");
        });
    });

    describe('binartarx', function() {
        var registry, spy1, spy2, spyUnsupportedEvent;

        beforeEach(function() {
            registry = new BinartaRX();

            spy1 = jasmine.createSpyObj('spy1', ['on']);
            spy2 = jasmine.createSpyObj('spy2', ['on']);
            spyUnsupportedEvent = jasmine.createSpyObj('spy-unsupported-event', ['notSupported']);
        });

        it('register and invoke listeners', function() {
            registry.add(spy1);
            registry.add(spy2);

            registry.forEach(function(l) {
                l.on('ctx');
            });

            expect(spy1.on).toHaveBeenCalledWith('ctx');
            expect(spy2.on).toHaveBeenCalledWith('ctx');
        });

        it('support notify for raising events', function() {
            registry.add(spy1);

            registry.forEach(function(l) {
                l.notify('on', 'ctx');
            });

            expect(spy1.on).toHaveBeenCalledWith('ctx');
        });

        it('listeners which do not suport the event are not notified', function() {
            registry.add(spyUnsupportedEvent);

            registry.forEach(function(l) {
                l.notify('on', 'ctx');
            });
        });

        it('deregister listeners', function() {
            registry.add(spy1);
            registry.remove(spy1);

            registry.forEach(function(l) {
                l.on();
            });

            expect(spy1.on).not.toHaveBeenCalled();
        });

        it('deregistering unknown listeners has no effect', function() {
            registry.add(spy1);
            registry.remove(spy2);

            registry.forEach(function(l) {
                l.on();
            });

            expect(spy1.on).toHaveBeenCalled();
            expect(spy2.on).not.toHaveBeenCalled();
        });

        it('deregistering listeners while events are being raised', function() {
            var deregisteringListener = new function() {
                var self = this;

                this.on = function() {
                    registry.remove(self);
                }
            };

            registry.add(deregisteringListener);
            registry.add(spy1);

            registry.forEach(function(l) {
                l.on();
            });

            expect(spy1.on).toHaveBeenCalled();
        });

        it('isEmpty exposes if any listeners are installed or not', function() {
            expect(registry.isEmpty()).toBeTruthy();
            registry.add(spy1);
            expect(registry.isEmpty()).toBeFalsy();
            registry.remove(spy1);
            expect(registry.isEmpty()).toBeTruthy();
        });
    });

    function UI() {
        this.showGreeting = function(greeting) {
            this.receivedGreeting = greeting;
        }
    }

    function SynchronousGreeter() {
        this.sayHello = function(who) {
            return "Hello " + who + "!";
        }
    }

    function AsynchronousGreeter() {
        this.sayHello = function(who) {
            this.ui.showGreeting("Hello " + who + "!");
        }
    }
})();