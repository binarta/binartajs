function BinartaPublisherjs() {
    var publisher = this;

    publisher.blog = new Blog();

    function Blog() {
        var blog = this;

        blog.published = new Posts();

        function Posts() {
            var posts = this;

            posts.cache = [];
            posts.status = 'idle';

            posts.posts = function (args) {
                if (!args)
                    args = {};
                if (!args.max)
                    args.max = posts.cache.length;
                return posts.cache.slice(0, args.max);
            };

            posts.init = function () {
                if (posts.cache.length == 0)
                    posts.more();
            };

            posts.more = function () {
                if (posts.status == 'loading')
                    return;
                posts.status = 'loading';
                var request = {
                    locale: publisher.binarta.application.localeForPresentation(),
                    subset: {offset: posts.cache.length, max: 10}
                };
                publisher.db.findAllPublishedBlogsForLocale(request, {
                    success: function (it) {
                        posts.cache = posts.cache.concat(it);
                        posts.status = 'idle';
                    }
                })
            };
        }

    }
}