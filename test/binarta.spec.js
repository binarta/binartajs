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