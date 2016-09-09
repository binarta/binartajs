function BinartaCheckpointjs() {
    var checkpoint = this;

    this.signinForm = new SigninForm();
    this.registrationForm = new RegistrationForm();
    this.profile = new Profile();

    function RegistrationForm() {
        var self = this;

        this.reset = function () {
            new IdleState(self);
        };
        this.reset();

        this.status = function () {
            return self.currentStatus.status;
        };

        this.violationReport = function () {
            return self.currentStatus.violationReport;
        };

        this.submit = function (creds, response) {
            self.currentStatus.submit(creds, response);
        };

        this.setAlreadyRegistered = function () {
            new RegisteredState(self);
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';
            this.violationReport = {};

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function WorkingState(fsm, creds, response) {
            fsm.currentStatus = this;
            this.status = 'working';
            this.violationReport = {};

            var request = {
                email: creds.email,
                alias: creds.username || creds.email,
                username: creds.username || creds.email,
                password: creds.password,
                vat: creds.vat,
                captcha: creds.captcha
            };
            checkpoint.gateway.register(request, {
                success: onSuccess,
                rejected: onRejection
            });

            function onSuccess() {
                self.setAlreadyRegistered();
                checkpoint.signinForm.submit({
                    username: request.username,
                    password: request.password
                }, response);
            }

            function onRejection(violationReport) {
                new RejectedState(fsm, violationReport, response);
            }
        }

        function RejectedState(fsm, violationReport, response) {
            fsm.currentStatus = this;
            if (fsm.eventListener)
                fsm.eventListener.rejected();
            if (response && response.rejected)
                response.rejected(violationReport);

            this.status = 'rejected';
            this.violationReport = violationReport;

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function RegisteredState(fsm) {
            fsm.currentStatus = this;
            this.status = 'registered';
            this.violationReport = {};

            this.submit = function () {
                throw new Error('already.registered');
            }
        }
    }

    function SigninForm() {
        var self = this;

        this.eventRegistry = new BinartaRX();

        this.reset = function () {
            new IdleState(self);
        };
        this.reset();

        this.status = function () {
            return self.currentStatus.status;
        };

        this.violation = function () {
            return self.currentStatus.violation;
        };

        this.submit = function (creds, response) {
            self.currentStatus.submit(creds, response);
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';
            this.violation = '';

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function WorkingState(fsm, creds, response) {
            fsm.currentStatus = this;
            this.status = 'working';
            this.violation = '';

            checkpoint.gateway.signin(creds, {
                success: onSuccess,
                rejected: onRejection
            });

            function onSuccess() {
                new AuthenticatedState(fsm);
                checkpoint.registrationForm.setAlreadyRegistered();
                checkpoint.profile.refresh(response);
                fsm.eventRegistry.forEach(function(l) {
                    l.signedin();
                });
            }

            function onRejection() {
                new RejectedState(fsm, response);
            }
        }

        function RejectedState(fsm, response) {
            fsm.currentStatus = this;
            this.status = 'rejected';
            this.violation = 'credentials.mismatch';

            if (response && response.rejected)
                response.rejected(fsm.violation());

            this.submit = function (creds, response) {
                new WorkingState(fsm, creds, response);
            }
        }

        function AuthenticatedState(fsm) {
            fsm.currentStatus = this;
            this.status = 'authenticated';
            this.violation = '';

            this.submit = function () {
                throw new Error('already.authenticated');
            }
        }
    }

    function Profile() {
        var self = this;
        var emptyViolationReport = {};

        this.metadataCache = {};
        this.permissionCache = [];
        this.updateProfileRequestDecorators = [];
        this.updateProfileHandlers = [];
        this.eventRegistry = new BinartaRX();

        this.status = function () {
            return self.currentStatus.status;
        };

        this.violationReport = function () {
            return self.currentStatus.violationReport || emptyViolationReport;
        };

        this.refresh = function (response) {
            response = toNoOpResponse(response);
            checkpoint.gateway.fetchAccountMetadata({
                unauthenticated: onSignout(response),
                activeAccountMetadata: onSignin(response)
            });
        };

        function onSignout(response) {
            return function () {
                self.authenticated = false;
                self.metadataCache = {};
                self.permissionCache = [];
                checkpoint.registrationForm.reset();
                checkpoint.signinForm.reset();
                response.unauthenticated();
                self.eventRegistry.forEach(function(l) {
                    l.notify('signedout');
                });
            }
        }

        function onSignin(response) {
            return function (metadata) {
                checkpoint.gateway.fetchPermissions(function(permissions) {
                    self.authenticated = true;
                    self.metadataCache = metadata;
                    self.permissionCache = permissions;
                    response.success();
                    self.eventRegistry.forEach(function(l) {
                        l.notify('signedin');
                    });
                });
            }
        }

        this.signout = function (response) {
            checkpoint.gateway.signout({unauthenticated:onSignout(toNoOpResponse(response))});
        };

        function toNoOpResponse(it) {
            var response = {
                success: function () {
                },
                unauthenticated: function () {
                }
            };
            if (it) {
                if (it.success)
                    response.success = it.success;
                if (it.unauthenticated)
                    response.unauthenticated = it.unauthenticated;
            }
            return response;
        }

        this.isAuthenticated = function () {
            return self.authenticated;
        };

        this.metadata = function () {
            return self.metadataCache;
        };

        this.permissions = function() {
            return self.permissionCache;
        };

        this.email = function () {
            return self.metadata().email;
        };

        function IdleState(fsm) {
            fsm.currentStatus = this;
            this.status = 'idle';

            fsm.edit = function () {
                new EditState(fsm);
            }
        }

        function EditState(fsm, rejectedRequest, violationReport) {
            fsm.currentStatus = this;
            this.status = 'editing';
            this.violationReport = violationReport || {};

            var request = rejectedRequest || fsm.updateProfileRequestDecorators.reduce(function (p, c) {
                return c(p);
            }, {});

            fsm.cancel = function () {
                new IdleState(fsm);
            };

            fsm.updateRequest = function () {
                return request;
            };

            fsm.update = function () {
                new WorkingState(fsm, request);
            };
        }

        function WorkingState(fsm, request) {
            fsm.currentStatus = this;
            this.status = 'working';

            var violationReport = {};
            var countdown = fsm.updateProfileHandlers.length;
            if (countdown > 0)
                fsm.updateProfileHandlers.forEach(function (it) {
                    it(request, {
                        success: function () {
                            if (--countdown == 0)
                                if (Object.keys(violationReport).length > 0)
                                    new EditState(fsm, violationReport);
                                else {
                                    new IdleState(fsm);
                                    fsm.eventRegistry.forEach(function(l) {
                                        l.updated();
                                    });
                                }
                        },
                        rejected: function (report) {
                            Object.keys(report).forEach(function (k) {
                                violationReport[k] = report[k];
                            });
                            if (--countdown == 0)
                                new EditState(fsm, request, violationReport);
                        }
                    });
                });
            else
                new IdleState(fsm);
        }

        new IdleState(this);
    }
}