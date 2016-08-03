function BinartaApplicationjs() {
    var app = this;
    var profileCache = {};

    app.profile = function() {
        return profileCache;
    };

    app.refresh = function(onSuccess) {
        app.gateway.fetchApplicationProfile({}, {success:function(profile) {
            profileCache = profile;
            if(onSuccess)
                onSuccess();
        }});
    }
}