(function() {
    describe('binarta-shopjs', function() {
        var binarta, ui;

        beforeEach(function() {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            factory.addSubSystems({shop: new BinartaShopjs()});
            binarta = factory.create();
        });

        describe('basket', function() {
            //describe('place purchase order', function() {
            //    it('submits order data to gateway', function() {
            //        binarta.shop.gateway = new function() {
            //            this.placePurchaseOrder = function(order) {
            //                this.capturedOrder = order;
            //            }
            //        };
            //        binarta.shop.basket.order = 'order';
            //        binarta.shop.basket.submit();
            //        expect(binarta.shop.gateway.capturedOrder).toEqual('order');
            //    });
            //
            //    it('test', function() {
            //        binarta.shop.gateway = new function() {
            //            this.placePurchaseOrder = function(order, response) {
            //                response.rejected({"attribute":["reason"]});
            //            }
            //        };
            //        binarta.shop.basket.submit();
            //        expect(binarta.shop.gateway.capturedOrder).toEqual('order');
            //    });
            //});
        });
    });

    function UI() {

    }
})();