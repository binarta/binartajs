function BinartaShopjs() {
    var shop = this;

    this.basket = new Basket();

    function Basket() {
        this.submit = function() {
            shop.gateway.placePurchaseOrder(this.order);
            //this.gateway.fetchAccountMetadata({activeAccountMetadata:function(it) {
            //    metadata = it;
            //}});
        };
    }
}