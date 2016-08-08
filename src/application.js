function BinartaApplicationjs() {
    var app = this;
    var profileCache = {};
    var cachedLocale;

    app.profile = function() {
        return profileCache;
    };

    app.locale = function() {
        return cachedLocale;
    };

    app.setLocale = function(locale) {
        localStorage.locale = locale;
        sessionStorage.locale = locale;
        cachedLocale = locale;
    };

    app.refresh = function(onSuccess) {
        refreshLocale();
        refreshApplicationProfile(onSuccess);
    };

    function refreshApplicationProfile(onSuccess) {
        app.gateway.fetchApplicationProfile({}, {success:function(profile) {
            profileCache = profile;
            if(onSuccess)
                onSuccess();
        }});
    }

    function refreshLocale() {
        cachedLocale = sessionStorage.locale || localStorage.locale || undefined;
        sessionStorage.locale = cachedLocale;
    }
}