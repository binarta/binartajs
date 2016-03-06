function BinartaCheckpointjs() {
    this.profile = new Profile();

    function Profile() {
        var metadata;

        this.billing = new Billing();

        this.refresh = function() {
            this.gateway.fetchAccountMetadata({activeAccountMetadata:function(it) {
                metadata = it;
            }});
        };

        function Billing() {
            this.isComplete = function() {
                return metadata && metadata.billing && metadata.billing.complete;
            }
        }
    }
}