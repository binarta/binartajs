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
                publisher: new BinartaPublisherjs({application: application})
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

            describe('given published log posts handle', function () {
                var handle, display;

                beforeEach(function () {
                    publisher.db = jasmine.createSpyObj('db', ['findAllPublishedBlogsForLocale']);
                    display = jasmine.createSpyObj('display', ['status', 'more']);
                    handle = publisher.blog.published(display);
                });

                describe('with noop decorator', function () {
                    beforeEach(function () {
                        handle.decorate = function (it) {
                            return it;
                        }
                    });

                    describe('loading more', function () {
                        beforeEach(function () {
                            publisher.db = {
                                findAllPublishedBlogsForLocale: function (request, response) {
                                }
                            };
                            handle.more();
                        });

                        it('loading more notifies display status as loading', function () {
                            expect(display.status).toHaveBeenCalledWith('loading');
                        });

                        it('is throttled when already loading', function () {
                            publisher.db = {
                                findAllPublishedBlogsForLocale: function (request, response) {
                                    throw new Error();
                                }
                            };
                            handle.more();
                        });
                    });

                    describe('and some blog posts are found', function () {
                        beforeEach(function () {
                            publisher.db = {
                                findAllPublishedBlogsForLocale: function (request, response) {
                                    response.success(['a', 'b', 'c']);
                                }
                            };
                            handle.more();
                        });

                        it('display received blog posts', function () {
                            expect(display.more).toHaveBeenCalledWith(['a', 'b', 'c']);
                        });

                        it('additional loads offset the subset', function () {
                            publisher.db = {
                                findAllPublishedBlogsForLocale: function (request, response) {
                                    expect(request.subset.offset).toEqual(3);
                                }
                            };
                            handle.more();
                        });
                    });

                    it('loads more blog posts using the currently active locale for presentation', function () {
                        binarta.application.setLocaleForPresentation('en');
                        publisher.db = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                expect(request.locale).toEqual('en');
                            }
                        };
                        handle.more();
                    });

                    it('load the default subset', function () {
                        publisher.db = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                expect(request.subset).toEqual({offset: 0, max: 10});
                            }
                        };
                        handle.more();
                    });

                    it('load the requested subset', function () {
                        publisher.db = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                expect(request.subset).toEqual({offset: 'o', max: 'm'});
                            }
                        };
                        handle.subset = {offset: 'o', max: 'm'};
                        handle.more();
                    });

                    it('when less blog posts are loaded than requested then notify display there are no more', function () {
                        publisher.db = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                response.success(['a', 'b', 'c']);
                            }
                        };
                        handle.subset = {offset: 0, max: 4};
                        handle.more();
                        expect(display.status).toHaveBeenCalledWith('no-more');
                    });

                    it('when the requested number of blog posts are found then notify display there are more', function () {
                        publisher.db = {
                            findAllPublishedBlogsForLocale: function (request, response) {
                                response.success(['a', 'b', 'c']);
                            }
                        };
                        handle.subset = {offset: 0, max: 3};
                        handle.more();
                        expect(display.status).toHaveBeenCalledWith('has-more');
                    });
                });

                it('loading published blog posts decorates them with a uri based on the id', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success([{id: 'x'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/x');
                });

                it('decorating published blog posts with a uri strips leading slashes from the id', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success([{id: '/x'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/x');
                });

                it('decorating published blog posts with a uri prefers the local id', function () {
                    publisher.db = {
                        findAllPublishedBlogsForLocale: function (request, response) {
                            response.success([{id: 'b', localId: 'p'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/p');
                });
            });

            describe('given draft blog posts handle', function () {
                var handle, display;

                beforeEach(function () {
                    publisher.db = jasmine.createSpyObj('db', ['findAllBlogsInDraftForLocale']);
                    display = jasmine.createSpyObj('display', ['status', 'more']);
                    handle = publisher.blog.drafts(display);
                });

                describe('with noop decorator', function () {
                    beforeEach(function () {
                        handle.decorate = function (it) {
                            return it;
                        }
                    });

                    describe('loading more', function () {
                        beforeEach(function () {
                            publisher.db = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                }
                            };
                            handle.more();
                        });

                        it('loading more notifies display status as loading', function () {
                            expect(display.status).toHaveBeenCalledWith('loading');
                        });

                        it('is throttled when already loading', function () {
                            publisher.db = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    throw new Error();
                                }
                            };
                            handle.more();
                        });
                    });

                    describe('and some blog posts are found', function () {
                        beforeEach(function () {
                            publisher.db = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    response.success(['a', 'b', 'c']);
                                }
                            };
                            handle.more();
                        });

                        it('display received blog posts', function () {
                            expect(display.more).toHaveBeenCalledWith(['a', 'b', 'c']);
                        });

                        it('additional loads offset the subset', function () {
                            publisher.db = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    expect(request.subset.offset).toEqual(3);
                                }
                            };
                            handle.more();
                        });
                    });

                    it('loads more blog posts using the currently active locale for presentation', function () {
                        binarta.application.setLocaleForPresentation('en');
                        publisher.db = {
                            findAllBlogsInDraftForLocale: function (request, response) {
                                expect(request.locale).toEqual('en');
                            }
                        };
                        handle.more();
                    });

                    it('load the default subset', function () {
                        publisher.db = {
                            findAllBlogsInDraftForLocale: function (request, response) {
                                expect(request.subset).toEqual({offset: 0, max: 10});
                            }
                        };
                        handle.more();
                    });

                    it('load the requested subset', function () {
                        publisher.db = {
                            findAllBlogsInDraftForLocale: function (request, response) {
                                expect(request.subset).toEqual({offset: 'o', max: 'm'});
                            }
                        };
                        handle.subset = {offset: 'o', max: 'm'};
                        handle.more();
                    });

                    it('when less blog posts are loaded than requested then notify display there are no more', function () {
                        publisher.db = {
                            findAllBlogsInDraftForLocale: function (request, response) {
                                response.success(['a', 'b', 'c']);
                            }
                        };
                        handle.subset = {offset: 0, max: 4};
                        handle.more();
                        expect(display.status).toHaveBeenCalledWith('no-more');
                    });

                    it('when the requested number of blog posts are found then notify display there are more', function () {
                        publisher.db = {
                            findAllBlogsInDraftForLocale: function (request, response) {
                                response.success(['a', 'b', 'c']);
                            }
                        };
                        handle.subset = {offset: 0, max: 3};
                        handle.more();
                        expect(display.status).toHaveBeenCalledWith('has-more');
                    });
                });

                it('loading published blog posts decorates them with a uri based on the id', function () {
                    publisher.db = {
                        findAllBlogsInDraftForLocale: function (request, response) {
                            response.success([{id: 'x'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/x');
                });

                it('decorating published blog posts with a uri strips leading slashes from the id', function () {
                    publisher.db = {
                        findAllBlogsInDraftForLocale: function (request, response) {
                            response.success([{id: '/x'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/x');
                });

                it('decorating published blog posts with a uri prefers the local id', function () {
                    publisher.db = {
                        findAllBlogsInDraftForLocale: function (request, response) {
                            response.success([{id: 'b', localId: 'p'}]);
                        }
                    };
                    handle.more();
                    expect(display.more.calls.mostRecent().args[0][0].uri).toEqual('/blog/post/p');
                });
            });

            describe('given a specific blog handle', function () {
                var handle, display;

                beforeEach(function () {
                    binarta.application.setLocaleForPresentation('en');
                    display = jasmine.createSpyObj('display', ['status', 'post', 'notFound', 'canceled', 'published', 'withdrawn', 'deleted']);
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
                        post = {id: 'p', status: 'draft'};
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

                    describe('when deleting', function () {
                        beforeEach(function () {
                            publisher.db.delete = jasmine.createSpy('delete');
                            handle.delete();
                        });

                        it('then expose deleting status', function () {
                            expect(display.status).toHaveBeenCalledWith('deleting');
                        });

                        it('then db is called', function () {
                            expect(publisher.db.delete).toHaveBeenCalled();
                        });
                    });

                    it('when deleting then db receives params', function () {
                        publisher.db.delete = function (request) {
                            expect(request).toEqual({id: 'p'})
                        };
                        handle.delete();
                    });

                    describe('when deleting succeeds', function () {
                        beforeEach(function () {
                            publisher.db.delete = function (request, response) {
                                response.success();
                            };
                            handle.delete();
                        });

                        it('then expose deleted status', function () {
                            expect(display.status).toHaveBeenCalledWith('deleted');
                        });

                        it('then notify display the blog post has been deleted', function () {
                            expect(display.deleted).toHaveBeenCalled();
                        });
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
                        beforeEach(function () {
                            onSuccessCallback();
                        });

                        it('then the post for the primary language is passed to the display', function () {
                            expect(display.post).toHaveBeenCalledWith(post);
                        });

                        it('then display receives translatable status', function () {
                            expect(display.status).toHaveBeenCalledWith('translatable');
                            expect(display.status.calls.mostRecent().args[0]).toEqual('translatable');
                        });

                        it('when application lock is regained the display status is not reset from translatable', function () {
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
            var supportedOperations = ['add', 'get', 'findAllPublishedBlogsForLocale', 'findAllBlogsInDraftForLocale', 'publish', 'withdraw'];

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

                    it('findAllBlogsInDraftForLocale', function () {
                        db.findAllBlogsInDraftForLocale('a', 'b', 'c');
                        expect(visitorDB.findAllBlogsInDraftForLocale).toHaveBeenCalledWith('a', 'b', 'c');
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

                    it('findAllBlogsInDraftForLocale', function () {
                        db.findAllBlogsInDraftForLocale('a', 'b', 'c');
                        expect(clerkDB.findAllBlogsInDraftForLocale).toHaveBeenCalledWith('a', 'b', 'c');
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
                        db.get('request', 'response');
                        expect(sourceDB.get.calls.mostRecent().args[0]).toEqual('request');
                    });

                    it('findAllPublishedBlogsForLocale', function () {
                        db.findAllPublishedBlogsForLocale({subset: {}}, 'response');
                        expect(sourceDB.findAllPublishedBlogsForLocale.calls.mostRecent().args[0]).toEqual({subset: {}});
                    });

                    it('findAllBlogsInDraftForLocale', function () {
                        db.findAllBlogsInDraftForLocale({subset: {}}, 'response');
                        expect(sourceDB.findAllBlogsInDraftForLocale.calls.mostRecent().args[0]).toEqual({subset: {}});
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

                    it('and previously read with not found handler then get returns the previous result when given the same request parameter', function () {
                        db.get({id: 'x'}, {
                            notFound: function () {
                            }
                        });
                        db.sourceDB = {
                            get: function () {
                                throw new Error();
                            }
                        };
                        db.get({id: 'x'}, response);
                        expect(response.notFound).toHaveBeenCalled();
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

                    it('and previously read with success handler then get returns the previously found blog post when given the same request parameter', function () {
                        db.get({id: 'x'}, {
                            success: function () {
                            }
                        });
                        db.sourceDB = {
                            get: function () {
                                throw new Error();
                            }
                        };
                        db.get({id: 'x'}, response);
                        expect(response.success).toHaveBeenCalledWith('p');
                    });
                });

                it('simultaneous get requests result in a single source db call', function () {
                    var response;
                    db.sourceDB = {
                        get: function (request, it) {
                            response = it;
                        }
                    };
                    var display1 = jasmine.createSpyObj('display1', ['success']);
                    var display2 = jasmine.createSpyObj('display2', ['success']);
                    db.get({id: 'x'}, display1);
                    db.sourceDB = {
                        get: function (request, it) {
                            throw new Error();
                        }
                    };
                    db.get({id: 'x'}, display2);
                    response.success('p');
                    expect(display1.success).toHaveBeenCalledWith('p');
                    expect(display2.success).toHaveBeenCalledWith('p');
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

                        it('then cached results are not shared with blogs in draft', function () {
                            db.sourceDB = {
                                findAllPublishedBlogsForLocale: function () {
                                    throw new Error();
                                },
                                findAllBlogsInDraftForLocale: function () {
                                }
                            };
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                            expect(response.success).not.toHaveBeenCalled();
                        });
                    });
                });

                describe('find all blogs in draft for locale', function () {
                    var response;

                    describe('on unauthenticated', function () {
                        beforeEach(function () {
                            response = jasmine.createSpyObj('response', ['unauthenticated']);
                            db.sourceDB = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    response.unauthenticated();
                                }
                            };
                        });

                        it('passes the notification to the given response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                            expect(response.unauthenticated).toHaveBeenCalled();
                        });

                        it('does not require a response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                        });

                        it('then does not require a handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                        });
                    });

                    describe('on forbidden', function () {
                        beforeEach(function () {
                            response = jasmine.createSpyObj('response', ['forbidden']);
                            db.sourceDB = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    response.forbidden();
                                }
                            };
                        });

                        it('passes the notification to the given response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                            expect(response.forbidden).toHaveBeenCalled();
                        });

                        it('does not require a response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                        });

                        it('then does not require a handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                        });
                    });

                    describe('on success', function () {
                        beforeEach(function () {
                            response = jasmine.createSpyObj('response', ['success']);
                            db.sourceDB = {
                                findAllBlogsInDraftForLocale: function (request, response) {
                                    response.success('p');
                                }
                            };
                        });

                        it('passes the posts to the given response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                            expect(response.success).toHaveBeenCalledWith('p');
                        });

                        it('does not require a response handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                        });

                        it('then get does not require a success handler', function () {
                            db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                        });

                        describe('and previously read', function () {
                            beforeEach(function () {
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                            });

                            it('then query returns the previously found blog posts when given the same request parameter', function () {
                                db.sourceDB = {
                                    findAllBlogsInDraftForLocale: function () {
                                        throw new Error();
                                    }
                                };
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, response);
                                expect(response.success).toHaveBeenCalledWith('p');
                            });

                            it('then calls the source db when given a request parameter with a different locale', function () {
                                db.sourceDB = sourceDB;
                                db.findAllBlogsInDraftForLocale({locale: '?', subset: {offset: 0, max: 10}});
                                expect(sourceDB.findAllBlogsInDraftForLocale).toHaveBeenCalled();
                            });

                            it('then calls the source db when given a request parameter with a different offset', function () {
                                db.sourceDB = sourceDB;
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 999, max: 10}});
                                expect(sourceDB.findAllBlogsInDraftForLocale).toHaveBeenCalled();
                            });

                            it('then calls the source db when given a request parameter with a different max', function () {
                                db.sourceDB = sourceDB;
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 999}});
                                expect(sourceDB.findAllBlogsInDraftForLocale).toHaveBeenCalled();
                            });

                            it('then a response handler is still optional', function () {
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}});
                            });

                            it('then a success handler is still optional', function () {
                                db.findAllBlogsInDraftForLocale({locale: 'en', subset: {offset: 0, max: 10}}, {});
                            });

                            it('then cached results are not shared with published blog posts', function () {
                                db.sourceDB = {
                                    findAllPublishedBlogsForLocale: function () {
                                    },
                                    findAllBlogsInDraftForLocale: function () {
                                        throw new Error();
                                    }
                                };
                                db.findAllPublishedBlogsForLocale({
                                    locale: 'en',
                                    subset: {offset: 0, max: 10}
                                }, response);
                                expect(response.success).not.toHaveBeenCalled();
                            });
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
