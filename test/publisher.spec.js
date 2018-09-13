(function () {
    describe('binarta-publisherjs', function () {
        var binarta, ui, publisher;

        beforeEach(function () {
            ui = new UI();
            var factory = new BinartajsFactory();
            factory.addUI(ui);
            var checkpoint = new BinartaCheckpointjs();
            var application = new BinartaApplicationjs();
            factory.addSubSystems({
                checkpoint: checkpoint,
                application: application,
                publisher: new BinartaPublisherjs()
            });
            binarta = factory.create();
            publisher = binarta.publisher;
        });

        describe('blogs', function () {
            beforeEach(function () {
                binarta.application.gateway = new ValidApplicationGateway();
                binarta.application.setProfile({supportedLanguages: ['en', 'nl']});
                binarta.application.setLocaleForPresentation('en');
            });

            it('sits in idle status', function () {
                expect(publisher.blog.published.status).toEqual('idle');
            });

            it('published posts start out empty', function () {
                expect(publisher.blog.published.posts()).toEqual([]);
            });

            it('adding draft delegates to db', function () {
                binarta.application.setLocaleForPresentation('en');
                publisher.db = jasmine.createSpyObj('db', ['add']);
                publisher.blog.add();
                expect(publisher.db.add).toHaveBeenCalled();
            });

            it('adding draft passes locale to db', function () {
                binarta.application.setLocaleForPresentation('en');
                publisher.db = {
                    add: function (request) {
                        expect(request.locale).toEqual('en');
                    }
                };
                publisher.blog.add();
            });

            it('adding draft takes a success listener which receives the newly created blog post id', function () {
                publisher.db = {
                    add: function (request, response) {
                        response.success('id');
                    }
                };
                var spy = jasmine.createSpyObj('listener', ['success']);
                publisher.blog.add(spy);
                expect(spy.success).toHaveBeenCalledWith('id');
            });

            it('adding draft takes an optional success listener', function () {
                publisher.db = {
                    add: function (request, response) {
                        response.success('-');
                    }
                };
                publisher.blog.add();
                publisher.blog.add({});
            });

            describe('with noop decorator', function () {
                beforeEach(function () {
                    publisher.blog.published.decorate = function (it) {
                        return it;
                    }
                });

                it('loading initial blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success(['a', 'b', 'c']);
                        }
                    };
                    publisher.blog.published.init();
                    expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c']);
                });

                it('loading of initial published blog posts is throttled once some posts have been found', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            throw new Error();
                        }
                    };
                    publisher.blog.published.cache = ['-'];
                    publisher.blog.published.init();
                });

                it('loading more blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success(['a', 'b', 'c']);
                        }
                    };
                    publisher.blog.published.more();
                    expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c']);
                });

                it('take the first few published blog posts when more are available', function () {
                    publisher.blog.published.cache = ['a', 'b', 'c'];
                    expect(publisher.blog.published.posts({max: 2})).toEqual(['a', 'b']);
                });

                it('take the first few published blog posts when less are available', function () {
                    publisher.blog.published.cache = ['a', 'b', 'c'];
                    expect(publisher.blog.published.posts({max: 5})).toEqual(['a', 'b', 'c']);
                });

                it('loading more blog posts appends to already loaded blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success(['d', 'e', 'f']);
                        }
                    };
                    publisher.blog.published.cache = ['a', 'b', 'c'];
                    publisher.blog.published.more();
                    expect(publisher.blog.published.posts()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
                });

                it('updates status while loading more blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                        }
                    };
                    publisher.blog.published.more();
                    expect(publisher.blog.published.status).toEqual('loading');
                });

                it('returns to idle status after loading more blog posts', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success([]);
                        }
                    };
                    publisher.blog.published.more();
                    expect(publisher.blog.published.status).toEqual('idle');
                });

                it('loading more published blog posts is throttled when already loading', function () {
                    publisher.blog.published.status = 'loading';
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            throw new Error();
                        }
                    };
                    publisher.blog.published.more();
                });

                it('loads more blog posts using the currently active locale for presentation', function () {
                    binarta.application.setLocaleForPresentation('en');
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            expect(request.locale).toEqual('en');
                        }
                    };
                    publisher.blog.published.more();
                });

                it('load first set of published blog post', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            expect(request.subset).toEqual({offset: 0, max: 10});
                        }
                    };
                    publisher.blog.published.more();
                });

                it('load next set of published blog post', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            expect(request.subset).toEqual({offset: 3, max: 10});
                        }
                    };
                    publisher.blog.published.cache = ['a', 'b', 'c'];
                    publisher.blog.published.more();
                });
            });

            it('initialising published blog posts decorates them with a uri based on the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'x'}]);
                    }
                };
                publisher.blog.published.init();
                expect(publisher.blog.published.posts()[0].uri).toEqual('/blog/post/x');
            });

            it('loading more published blog posts decorates them with a uri based on the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'x'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('/blog/post/x');
            });

            it('decorating published blog posts with a uri strips leading slashes from the id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: '/x'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('/blog/post/x');
            });

            it('decorating published blog posts with a uri prefers the local id', function () {
                publisher.db = {
                    findAllPublishedBlogsForLocale: function (request, response) {
                        response.success([{id: 'b', localId: 'p'}]);
                    }
                };
                publisher.blog.published.more();
                expect(publisher.blog.published.posts()[0].uri).toEqual('/blog/post/p');
            });

            describe('given a specific blog handle', function () {
                var handle, display;

                beforeEach(function () {
                    binarta.application.setLocaleForPresentation('en');
                    display = jasmine.createSpyObj('display', ['status', 'post', 'notFound', 'canceled', 'published', 'withdrawn']);
                    handle = publisher.blog.get('b').connect(display);
                });

                it('exposed status is idle', function () {
                    expect(display.status).toHaveBeenCalledWith('idle');
                });

                it('while fetching the blog post to render the exposes status is loading', function () {
                    publisher.db = {
                        get: function (request, response) {
                        }
                    };
                    handle.render();
                    expect(display.status).toHaveBeenCalledWith('loading');
                });

                describe('when the blog post could not be found', function () {
                    beforeEach(function () {
                        publisher.db = {
                            get: function (request, response) {
                                response.notFound();
                            }
                        };
                        handle.render();
                    });

                    it('then the display indicates not found for unknown blogs', function () {
                        expect(display.notFound).toHaveBeenCalled();
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(display.status).toHaveBeenCalledWith('idle');
                    });
                });

                it('rendering passes params to db', function () {
                    publisher.db = {
                        get: function (request, response) {
                            expect(request).toEqual({
                                id: 'b',
                                locale: 'en'
                            });
                        }
                    };
                    handle.render();
                });

                describe('when draft is found', function () {
                    var post;

                    beforeEach(function () {
                        post = {status: 'draft'};
                        publisher.db = {
                            get: function (request, response) {
                                response.success(post);
                            }
                        };
                        display.status.calls.reset();
                        handle.render();
                    });

                    it('then the display renders the blog post', function () {
                        expect(display.post).toHaveBeenCalledWith(post);
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(display.status).toHaveBeenCalledWith('idle');
                    });

                    describe('and user has permission to publish blog posts', function () {
                        beforeEach(function () {
                            binarta.checkpoint.gateway = new ValidCredentialsGateway();
                            binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                                response.success([
                                    {name: 'publish.blog.post'},
                                    {name: 'draft.blog.post.in.another.language'}
                                ]);
                            };
                            binarta.checkpoint.signinForm.submit({});
                        });

                        it('then the exposed status remains idle as the application lock is still open', function () {
                            expect(display.status).not.toHaveBeenCalledWith('publishable');
                        });

                        describe('and application lock is acquired', function () {
                            beforeEach(function () {
                                display.status.calls.reset();
                                binarta.application.lock.reserve();
                            });

                            it('then the exposed status becomes publishable', function () {
                                expect(display.status).toHaveBeenCalledWith('publishable');
                                expect(display.status).not.toHaveBeenCalledWith('translatable');
                            });

                            it('return to idle on signout', function () {
                                binarta.checkpoint.profile.signout();
                                expect(display.status).toHaveBeenCalledWith('idle');
                            });

                            it('return to idle when application lock is released', function () {
                                binarta.application.lock.release();
                                expect(display.status).toHaveBeenCalledWith('idle');
                            });
                        });
                    });

                    it('and user has permission to withdraw blog posts then the exposed status remains idle as we already have a draft', function () {
                        binarta.checkpoint.gateway = new ValidCredentialsGateway();
                        binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                            response.success([
                                {name: 'withdraw.blog.post'},
                                {name: 'draft.blog.post.in.another.language'}
                            ]);
                        };
                        binarta.checkpoint.signinForm.submit({});
                        binarta.application.lock.reserve();
                        expect(display.status).not.toHaveBeenCalledWith('withdrawable');
                        expect(display.status).not.toHaveBeenCalledWith('translatable');
                    });
                });

                describe('when publication is found', function () {
                    var post;

                    beforeEach(function () {
                        post = {status: 'published'};
                        publisher.db = {
                            get: function (request, response) {
                                response.success(post);
                            }
                        };
                        display.status.calls.reset();
                        handle.render();
                    });

                    it('then the display renders the blog post', function () {
                        expect(display.post).toHaveBeenCalledWith(post);
                    });

                    it('then the exposed status returns to idle', function () {
                        expect(display.status).toHaveBeenCalledWith('idle');
                    });

                    describe('and user has permission to withdraw blog posts', function () {
                        beforeEach(function () {
                            binarta.checkpoint.gateway = new ValidCredentialsGateway();
                            binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                                response.success([{name: 'withdraw.blog.post'}]);
                            };
                            binarta.checkpoint.signinForm.submit({});
                        });

                        it('then the exposed status remains idle as the application lock is still open', function () {
                            expect(display.status).not.toHaveBeenCalledWith('withdrawable');
                        });

                        describe('and application lock is acquired', function () {
                            beforeEach(function () {
                                display.status.calls.reset();
                                binarta.application.lock.reserve();
                            });

                            it('then the exposed status becomes withdrawable', function () {
                                expect(display.status).toHaveBeenCalledWith('withdrawable');
                            });

                            it('return to idle on signout', function () {
                                binarta.checkpoint.profile.signout();
                                expect(display.status).toHaveBeenCalledWith('idle');
                            });

                            it('return to idle when application lock is released', function () {
                                binarta.application.lock.release();
                                expect(display.status).toHaveBeenCalledWith('idle');
                            });
                        });
                    });

                    it('and user has permission to publish blog posts then the exposed status remains idle as we already have a publication', function () {
                        binarta.checkpoint.gateway = new ValidCredentialsGateway();
                        binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                            response.success([{name: 'publish.blog.post'}]);
                        };
                        binarta.checkpoint.signinForm.submit({});
                        binarta.application.lock.reserve();
                        expect(display.status).not.toHaveBeenCalledWith('publishable');
                    });

                    it('and circumstances for withdrawal are gained after disconnecting the handler then display does not receive notice', function () {
                        handle.disconnect();
                        binarta.checkpoint.gateway = new ValidCredentialsGateway();
                        binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                            response.success([{name: 'withdraw.blog.post'}]);
                        };
                        binarta.checkpoint.signinForm.submit({});
                        binarta.application.lock.reserve();
                        expect(display.status).not.toHaveBeenCalledWith('withdrawable');
                    });
                });

                it('publishing prompts the UI for the publication time to use', function () {
                    ui.promptForPublicationTime = jasmine.createSpy();
                    handle.publish();
                    expect(ui.promptForPublicationTime).toHaveBeenCalled();
                });

                describe('when canceling the prompt for publication time', function () {
                    beforeEach(function () {
                        ui.promptForPublicationTime = function (response) {
                            response.cancel();
                        };
                        publisher.db = jasmine.createSpyObj('db', ['publish']);
                    });

                    it('then the publication request is not sent to the backend', function () {
                        handle.publish();
                        expect(publisher.db.publish).not.toHaveBeenCalled();
                    });

                    it('then the appropriate callback is executed', function () {
                        handle.publish();
                        expect(display.canceled).toHaveBeenCalled();
                    });
                });
            });

            describe('given a specific blog handle after signin as clerk', function () {
                var handle, display;

                beforeEach(function () {
                    binarta.application.setLocaleForPresentation('en');
                    display = jasmine.createSpyObj('display', ['status', 'post', 'notFound', 'canceled', 'published', 'withdrawn', 'drafted']);
                    binarta.checkpoint.gateway = new ValidCredentialsGateway();
                    binarta.checkpoint.gateway.fetchPermissions = function (request, response) {
                        response.success([
                            {name: 'publish.blog.post'},
                            {name: 'withdraw.blog.post'},
                            {name: 'draft.blog.post.in.another.language'}
                        ]);
                    };
                    binarta.checkpoint.signinForm.submit({});
                    binarta.application.lock.reserve();
                    handle = publisher.blog.get('b').connect(display);
                });

                describe('when publication is found', function () {
                    var post;

                    beforeEach(function () {
                        post = {id: 'p', status: 'published'};
                        publisher.db = {
                            get: function (request, response) {
                                response.success(post);
                            },
                            withdraw: function (request, response) {
                                response.success();
                            }
                        };
                        handle.render();
                    });

                    it('then the exposed status becomes withdrawable', function () {
                        expect(display.status).toHaveBeenCalledWith('withdrawable');
                        expect(display.status).not.toHaveBeenCalledWith('publishable');
                    });

                    describe('when publication is withdrawn', function () {
                        beforeEach(function () {
                            post = {status: 'draft'};
                            handle.withdraw();
                        });

                        it('then the post is resubmitted to the display', function () {
                            expect(display.post).toHaveBeenCalledWith(post);
                        });

                        it('then the status becomes publishable', function () {
                            expect(display.status).toHaveBeenCalledWith('publishable');
                        });

                        it('then executes callback', function () {
                            expect(display.withdrawn).toHaveBeenCalled();
                        });
                    });

                    it('withdrawing passes params to db', function () {
                        publisher.db = {
                            withdraw: function (request, response) {
                                expect(request).toEqual({
                                    id: 'p',
                                    locale: 'en'
                                });
                            }
                        };
                        handle.withdraw();
                    });

                    it('while withdrawing the exposed status is withdrawing', function () {
                        publisher.db = {
                            withdraw: function (request, response) {
                            }
                        };
                        handle.withdraw();
                        expect(display.status).toHaveBeenCalledWith('withdrawing');
                    });
                });

                describe('when draft is found', function () {
                    var post;

                    beforeEach(function () {
                        post = {id: 'p', status: 'draft'};
                        publisher.db = {
                            get: function (request, response) {
                                response.success(post);
                            },
                            publish: function (request, response) {
                                response.success();
                            }
                        };
                        handle.render();
                    });

                    it('then the exposed status becomes publishable', function () {
                        expect(display.status).toHaveBeenCalledWith('publishable');
                        expect(display.status).not.toHaveBeenCalledWith('withdrawable');
                    });

                    describe('when draft is published', function () {
                        beforeEach(function () {
                            post = {status: 'published'};
                            handle.publish();
                        });

                        it('then the post is resubmitted to the display', function () {
                            expect(display.post).toHaveBeenCalledWith(post);
                        });

                        it('then the status becomes withdrawable', function () {
                            expect(display.status).toHaveBeenCalledWith('withdrawable');
                        });

                        it('then executes callback', function () {
                            expect(display.published).toHaveBeenCalled();
                        });
                    });

                    it('publishing passes params to db', function () {
                        publisher.db = {
                            publish: function (request, response) {
                                expect(request).toEqual({
                                    timestamp: 't',
                                    id: 'p',
                                    locale: 'en'
                                });
                            }
                        };
                        handle.publish();
                    });

                    it('while publishing the exposed status is publishing', function () {
                        publisher.db = {
                            publish: function (request, response) {
                            }
                        };
                        handle.publish();
                        expect(display.status).toHaveBeenCalledWith('publishing');
                    });
                });

                it('and post is found for a secondary language it can not become translatable', function () {
                    binarta.application.setLocaleForPresentation('nl');
                    var post = {id: 'p', status: 'draft'};
                    publisher.db = {
                        get: function (request, response) {
                            response.success(post);
                        }
                    };
                    handle.render();
                    expect(display.status).not.toHaveBeenCalledWith('translatable');
                });

                it('when no post could be found for the primary language then display receives not found notification', function () {
                    publisher.db = {
                        get: function (request, response) {
                            response.notFound();
                        }
                    };
                    handle.render();
                    expect(display.notFound).toHaveBeenCalled();
                });

                describe('when no post could be found for a secondary language', function () {
                    var post, onSuccessCallback;

                    beforeEach(function () {
                        post = {id: 'p'};
                        binarta.application.setLocaleForPresentation('nl');
                        publisher.db = {
                            get: function (request, response) {
                                if (request.locale == binarta.application.primaryLanguage())
                                    onSuccessCallback = function () {
                                        response.success(post);
                                    };
                                else
                                    response.notFound();
                            }
                        };
                        handle.render();
                    });

                    it('then display does not receive not found notification', function () {
                        expect(display.status).not.toHaveBeenCalledWith('not-found');
                    });

                    it('then display does not yet received translatable status as primary language post is not yet loaded', function () {
                        expect(display.status).not.toHaveBeenCalledWith('translatable');
                    });

                    describe('and post for primary language is received', function () {
                        beforeEach(function() {
                            onSuccessCallback();
                        });

                        it('then the post for the primary language is passed to the display', function () {
                            expect(display.post).toHaveBeenCalledWith(post);
                        });

                        it('then display receives translatable status', function () {
                            expect(display.status).toHaveBeenCalledWith('translatable');
                            expect(display.status.calls.mostRecent().args[0]).toEqual('translatable');
                        });

                        it('when application lock is regained the display status is not reset from translatable', function() {
                            display.status.calls.reset();
                            binarta.application.lock.release();
                            binarta.application.lock.reserve();
                            expect(display.status).not.toHaveBeenCalledWith('publishable');
                            expect(display.status).not.toHaveBeenCalledWith('withdrawable');
                            expect(display.status).toHaveBeenCalledWith('translatable');
                        });

                        it('when creating a draft in another language status indicates the draft is being created', function () {
                            binarta.publisher.db = {
                                draftInAnotherLanguage: function (request, response) {
                                }
                            };
                            handle.draft();
                            expect(display.status).toHaveBeenCalledWith('drafting');
                        });

                        describe('when a draft in another language is created', function () {
                            beforeEach(function () {
                                post = {id: 'd'};
                                binarta.publisher.db.draftInAnotherLanguage = function (request, response) {
                                    display.status.calls.reset();
                                    response.success();
                                };
                                handle.draft();
                            });

                            it('then display received idle status', function () {
                                expect(display.status).toHaveBeenCalledWith('idle');
                            });

                            it('then display received drafted notification', function () {
                                expect(display.drafted).toHaveBeenCalled();
                            });

                            it('then display received newly created draft', function () {
                                onSuccessCallback();
                                expect(display.post).toHaveBeenCalledWith(post);
                            });
                        });

                        it('when creating a draft in another language pass params to db', function () {
                            binarta.publisher.db = {
                                draftInAnotherLanguage: function (request, response) {
                                    expect(request.id).toEqual('p');
                                    expect(request.locale).toEqual('nl');
                                }
                            };
                            handle.draft();
                        });
                    });
                });
            });
        });

        describe('database decorators', function () {
            var supportedOperations = ['add', 'get', 'findAllPublishedBlogsForLocale', 'publish', 'withdraw'];

            describe('routing by application lock decorator', function () {
                var db, visitorDB, clerkDB;

                beforeEach(function () {
                    visitorDB = jasmine.createSpyObj('visitor-db', supportedOperations);
                    clerkDB = jasmine.createSpyObj('clerk-db', supportedOperations);
                    db = binarta.publisher.newRoutingByApplicationLockDB(visitorDB, clerkDB);
                });

                describe('in normal mode route to visitor db:', function () {
                    it('add', function () {
                        db.add('a', 'b', 'c');
                        expect(visitorDB.add).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('get', function () {
                        db.get('a', 'b', 'c');
                        expect(visitorDB.get).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('findAllPublishedBlogsForLocale', function () {
                        db.findAllPublishedBlogsForLocale('a', 'b', 'c');
                        expect(visitorDB.findAllPublishedBlogsForLocale).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('publish', function () {
                        db.publish('a', 'b', 'c');
                        expect(visitorDB.publish).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('withdraw', function () {
                        db.withdraw('a', 'b', 'c');
                        expect(visitorDB.withdraw).toHaveBeenCalledWith('a', 'b', 'c');
                    });
                });

                describe('in edit mode route to clerk db:', function () {
                    beforeEach(function () {
                        binarta.application.lock.reserve();
                    });

                    it('add', function () {
                        db.add('a', 'b', 'c');
                        expect(clerkDB.add).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('get', function () {
                        db.get('a', 'b', 'c');
                        expect(clerkDB.get).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('findAllPublishedBlogsForLocale', function () {
                        db.findAllPublishedBlogsForLocale('a', 'b', 'c');
                        expect(clerkDB.findAllPublishedBlogsForLocale).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('publish', function () {
                        db.publish('a', 'b', 'c');
                        expect(clerkDB.publish).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('withdraw', function () {
                        db.withdraw('a', 'b', 'c');
                        expect(clerkDB.withdraw).toHaveBeenCalledWith('a', 'b', 'c');
                    });
                });
            });

            describe('caching decorator', function () {
                var db, sourceDB;

                beforeEach(function () {
                    sourceDB = jasmine.createSpyObj('source-db', supportedOperations);
                    db = binarta.publisher.newCachingDB(sourceDB);
                });

                describe('delegates to source:', function () {
                    var readOnlyErrorMessage = 'CachingDecorator is a read-only proxy!';

                    it('add', function () {
                        expect(db.add).toThrow(readOnlyErrorMessage);
                    });

                    it('get', function () {
                        db.get('a', 'b', 'c');
                        expect(sourceDB.get).toHaveBeenCalledWith('a', 'b', 'c');
                    });

                    it('findAllPublishedBlogsForLocale', function () {
                        db.findAllPublishedBlogsForLocale({subset: {}}, 'b', 'c');
                        expect(sourceDB.findAllPublishedBlogsForLocale).toHaveBeenCalledWith({subset: {}}, 'b', 'c');
                    });

                    it('publish', function () {
                        expect(db.publish).toThrow(readOnlyErrorMessage);
                    });

                    it('withdraw', function () {
                        expect(db.withdraw).toThrow(readOnlyErrorMessage);
                    });
                });

                describe('given unknown blog post', function () {
                    var response;

                    beforeEach(function () {
                        response = jasmine.createSpyObj('response', ['notFound']);
                        db.sourceDB = {
                            get: function (request, response) {
                                response.notFound();
                            }
                        };
                    });

                    it('then get passes the post to the given response handler', function () {
                        db.get({id: 'x'}, response);
                        expect(response.notFound).toHaveBeenCalled();
                    });

                    it('then get does not require a response handler', function () {
                        db.get({id: 'x'});
                    });

                    it('then get does not require a not found handler', function () {
                        db.get({id: 'x'}, {});
                    });

                    describe('and previously read', function () {
                        beforeEach(function () {
                            db.get({id: 'x'});
                        });

                        it('then get remembers the post was not found given the same request parameter', function () {
                            db.sourceDB = {
                                get: function () {
                                    throw new Error();
                                }
                            };
                            db.get({id: 'x'}, response);
                            expect(response.notFound).toHaveBeenCalled();
                        });

                        it('then get calls the source db when given a request parameter with a different id', function () {
                            db.sourceDB = sourceDB;
                            db.get({id: '?'});
                            expect(sourceDB.get).toHaveBeenCalled();
                        });

                        it('then get calls the source db when given a request parameter with a different locale', function () {
                            db.sourceDB = sourceDB;
                            db.get({id: 'x', locale: '?'});
                            expect(sourceDB.get).toHaveBeenCalled();
                        });

                        it('then a response handler is still optional', function () {
                            db.get({id: 'x'});
                        });

                        it('then a not found handler is still optional', function () {
                            db.get({id: 'x'}, {});
                        });
                    });
                });

                describe('given known blog post', function () {
                    var response;

                    beforeEach(function () {
                        response = jasmine.createSpyObj('response', ['success']);
                        db.sourceDB = {
                            get: function (request, response) {
                                response.success('p');
                            }
                        };
                    });

                    it('then get passes the post to the given response handler', function () {
                        db.get({id: 'x'}, response);
                        expect(response.success).toHaveBeenCalledWith('p');
                    });

                    it('then get does not require a response handler', function () {
                        db.get({id: 'x'});
                    });

                    it('then get does not require a success handler', function () {
                        db.get({id: 'x'}, {});
                    });

                    describe('and previously read', function () {
                        beforeEach(function () {
                            db.get({id: 'x'});
                        });

                        it('then get returns the previously found blog post when given the same request parameter', function () {
                            db.sourceDB = {
                                get: function () {
                                    throw new Error();
                                }
                            };
                            db.get({id: 'x'}, response);
                            expect(response.success).toHaveBeenCalledWith('p');
                        });

                        it('then get calls the source db when given a request parameter with a different id', function () {
                            db.sourceDB = sourceDB;
                            db.get({id: '?'});
                            expect(sourceDB.get).toHaveBeenCalled();
                        });

                        it('then get calls the source db when given a request parameter with a different locale', function () {
                            db.sourceDB = sourceDB;
                            db.get({id: 'x', locale: '?'});
                            expect(sourceDB.get).toHaveBeenCalled();
                        });

                        it('then a response handler is still optional', function () {
                            db.get({id: 'x'});
                        });

                        it('then a success handler is still optional', function () {
                            db.get({id: 'x'}, {});
                        });
                    });
                });

                it('get with local id creates a cache for the actual id', function () {
                    db.sourceDB = {
                        get: function (request, response) {
                            response.success({id: 'p'});
                        }
                    };
                    db.get({id: 'l'});
                    db.sourceDB = {
                        get: function () {
                            throw new Error();
                        }
                    };
                    db.get({id: 'p'});
                });

                describe('find all published blog posts for locale', function () {
                    var response;

                    beforeEach(function () {
                        response = jasmine.createSpyObj('response', ['success']);
                        db.sourceDB = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                response.success('p');
                            }
                        };
                    });

                    it('passes the posts to the given response handler', function () {
                        db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                        expect(response.success).toHaveBeenCalledWith('p');
                    });

                    it('does not require a response handler', function () {
                        db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                    });

                    it('then get does not require a success handler', function () {
                        db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                    });

                    describe('and previously read', function () {
                        beforeEach(function () {
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                        });

                        it('then query returns the previously found blog posts when given the same request parameter', function () {
                            db.sourceDB = {
                                findAllPublishedBlogsForLocale: function () {
                                    throw new Error();
                                }
                            };
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                            expect(response.success).toHaveBeenCalledWith('p');
                        });

                        it('then calls the source db when given a request parameter with a different locale', function () {
                            db.sourceDB = sourceDB;
                            db.findAllPublishedBlogsForLocale({locale: '?', subset: {offset: 0, max: 10}});
                            expect(sourceDB.findAllPublishedBlogsForLocale).toHaveBeenCalled();
                        });

                        it('then calls the source db when given a request parameter with a different offset', function () {
                            db.sourceDB = sourceDB;
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 999, max: 10}});
                            expect(sourceDB.findAllPublishedBlogsForLocale).toHaveBeenCalled();
                        });

                        it('then calls the source db when given a request parameter with a different max', function () {
                            db.sourceDB = sourceDB;
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 999}});
                            expect(sourceDB.findAllPublishedBlogsForLocale).toHaveBeenCalled();
                        });

                        it('then a response handler is still optional', function () {
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                        });

                        it('then a success handler is still optional', function () {
                            db.findAllPublishedBlogsForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                        });
                    });
                });
            });
        });
    });

    function UI() {
        this.promptForPublicationTime = function (response) {
            response.success('t');
        }
    }
})();
