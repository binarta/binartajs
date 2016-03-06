function BinartaInMemoryGatewaysjs() {
    this.checkpoint = new CheckpointGateway();

    function CheckpointGateway() {
        this.fetchAccountMetadata = function(response) {
            response.activeAccountMetadata({billing:{complete:false}});
        }
    }
}