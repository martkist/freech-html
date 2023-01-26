// freech_actions.js
// 2013 Miguel Freitas
//
// This file contains some freech "actions" like requesting
// posts from dht, sending posts, replies. It seems to be a
// intermediate layer between freech_io and interface, but
// separation is not clearly defined. Perhaps it would be better
// to get rid of this file altogether.

// global variables

var postsPerRefresh = 10;
var maxExpandPost = 8;
var maxExpandPostTop = 4;

// ----------------

function requestRepliedBefore(postLi)
{
    if(postLi.siblings().length >= maxExpandPostTop)
        return;

    var originalPost = postLi.find(".post-data");
    var reply_n = originalPost.attr('data-replied-to-screen-name');
    var reply_k = originalPost.attr('data-replied-to-id');

    if( reply_n != undefined && reply_k != undefined ) {
        if (reply_n[0] !== '!') {
            dhtget(reply_n, "post" + reply_k, "s",
                function (postLi, postFromJson) {
                    if (postFromJson) {
                        postLi.find('textarea').textcomplete('destroy'); // FIXME maybe we need to reset position instead (but curently it's cheaper)
                        var newStreamPost = postToElem(postFromJson, "related");
                        newStreamPost.hide();
                        postLi.before(newStreamPost);
                        newStreamPost.slideDown("fast");
                        $.MAL.relatedPostLoaded();
                        requestRepliedBefore(newStreamPost);
                    }
                }, postLi);
        } else {
            //replied to a promoted post... try to get it..
            var params = [1, parseInt(reply_k)];
            freechRpc("getspamposts", params,
                function (postLi, postFromJson) {
                    if (postFromJson) {
                        postLi.find('textarea').textcomplete('destroy'); // FIXME maybe we need to reset position instead (but curently it's cheaper)
                        var newStreamPost = postToElem(postFromJson[0], "related", 1);
                        newStreamPost.hide();
                        postLi.before(newStreamPost);
                        newStreamPost.slideDown("fast");
                        $.MAL.relatedPostLoaded();
                        requestRepliedBefore(newStreamPost);
                    }
                }, postLi, function(arg,ret) {console.log(ret)});
        }
    }
}

function requestRepliesAfter(postLi)
{
    if($.MAL.getExpandedPostsCount(postLi) >= maxExpandPost)
        return;

    var originalPost = postLi.find(".post-data");
    var original_n = originalPost.attr('data-screen-name');
    var original_k = originalPost.attr('data-id');

    if( original_n != undefined && original_k != undefined ) {
        dhtget( original_n, "replies" + original_k, "m", $.MAL.reqRepAfterCB, postLi);
    }
}

function getTopPostOfConversation(postLi, post, postboard) {
    var reply_n;
    var reply_k;

    if (post && typeof(post) !== 'undefined' && "reply" in post["userpost"]) {
        reply_k = post["userpost"]["reply"]["k"];
        reply_n = post["userpost"]["reply"]["n"];
    } else if (postLi && typeof(postLi) !== 'undefined') {
        var originalPost = postLi.find(".post-data");
        reply_n = originalPost.attr('data-replied-to-screen-name');
        reply_k = originalPost.attr('data-replied-to-id');
    }

    if( reply_n != undefined && reply_k != undefined ) {
        dhtget( reply_n, "post" + reply_k, "s",
            function(postLi, postFromJson) {
                getTopPostOfConversation(null, postFromJson, postboard);
            }, postLi);
    } else {
        var newStreamPost;
        if (post)
            newStreamPost = postToElem(post, "related");
        else {
            newStreamPost = postLi.clone(true);
            newStreamPost.removeClass('original');
            newStreamPost.addClass('related');
            newStreamPost.find('.expanded-content').hide();
            newStreamPost.find('.show-more').hide();
        }
        requestRepliesAfterAll(newStreamPost);
        newStreamPost.find('.post-expand').remove();
        newStreamPost.unbind('click');
        newStreamPost.hide();
        postboard.append(newStreamPost);
        newStreamPost.slideDown("fast");
    }
}

function requestRepliesAfterAll(postLi)
{
    var originalPost = postLi.find(".post-data");
    var original_n = originalPost.attr('data-screen-name');
    var original_k = originalPost.attr('data-id');

    if( original_n != undefined && original_k != undefined ) {
        dhtget( original_n, "replies" + original_k, "m", $.MAL.reqRepAfterCB, postLi);
    }
}

function requestRTs(postLi)
{
    var originalPost = postLi.find(".post-data");

    var original_n = originalPost.attr('data-screen-name');
    var original_k = originalPost.attr('data-id');

    if( original_n != undefined && original_k != undefined ) {
        dhtget( original_n, "rts" + original_k, "m",
               function(originalPost, postsFromJson) {

                    if( postsFromJson.length ) {
                        var statCountValue = originalPost.find(".stat-count-value");
                        statCountValue.text( postsFromJson.length );

                        var avatarRow = originalPost.find(".avatar-row");
                        avatarRow.empty();
                        for( var i = 0; i < postsFromJson.length && i < 8; i++) {
                            var n = postsFromJson[i]["userpost"]["n"];
                            var elemUser = $("#avatar-row-template").clone(true);
                            elemUser.removeAttr('id');
                            elemUser.attr('href',$.MAL.userUrl(n));
                            getFullname(n,elemUser.find(".user-name-tooltip"));
                            getAvatar(n,elemUser.find(".size24"));
                            avatarRow.append( elemUser );
                        }

                        originalPost.find(".post-stats").slideDown("fast");
                    }
               }, originalPost);
    }
}

function appendPostToElem(post, elem) {
    // posts without non-empty strings in both 'msg' and 'rt.msg' may be used for metadata like 'url' and are not meant to be displayed
    if ((typeof post.userpost.msg !== 'string' || post.userpost.msg === '')
        && (typeof post.userpost.rt !== 'object'
            || typeof post.userpost.rt.msg !== 'string' || post.userpost.rt.msg === ''))
        return;

    postToElem(post, 'original').hide().appendTo(elem).slideDown('fast');

    $.MAL.postboardLoaded();
}

var profilePostsLoading = false;

function requestPost(containerToAppend,username,resource,cbFunc,cbArgs){

    //console.log('dhtget '+username+' '+resource);

    dhtget( username, resource, "s",
        function(args, postFromJson) {
            if( postFromJson ) {

            //console.log(postFromJson);

            appendPostToElem(postFromJson, args.containerToAppend);

            if(args.cbFunc!=undefined) args.cbFunc(args.cbArgs);

            }
        },
        {containerToAppend:containerToAppend,cbFunc:cbFunc,cbArgs:cbArgs}
    );

}

function requestPostRecursively(containerToAppend,username,resource,count,useGetposts)
{
    var max_id = -1;
    if( !resource ) {
        var streamItems = containerToAppend.children();
        if( streamItems.length != 0 ) {
            var lastItem = streamItems.eq(streamItems.length-1);
            resource = "post" + lastItem.find(".post-data").attr("data-lastk");
            max_id = parseInt(lastItem.find(".post-data").attr("data-lastk"));
        }
    }

    profilePostsLoading = true;

    if( useGetposts ) {
        req = {username: username}
        if( max_id != -1 ) {
            req.max_id = max_id;
        }

        freechRpc("getposts", [count,[req]],
                       function(args, posts) {
                           for( var i = 0; i < posts.length; i++ ) {
                                appendPostToElem(posts[i], args.containerToAppend);
                           }
                           profilePostsLoading = false;
                       }, {containerToAppend:containerToAppend},
                       function(args, ret) {
                           profilePostsLoading = false;
                       }, {});
    } else {
        dhtget( username, resource, "s",
            function(args, postFromJson) {
               if( postFromJson ) {
                    appendPostToElem(postFromJson, args.containerToAppend);

                   if( args.count > 1 ) {
                       var userpost = postFromJson["userpost"];
                       var n = userpost["n"];
                       var lastk = userpost["lastk"];
                       if( lastk == undefined )
                           lastk = userpost["k"] - 1; // not true with directmsgs in stream

                       requestPostRecursively(args.containerToAppend, n, "post"+lastk, count-1);
                   } else {
                       profilePostsLoading = false;
                       args.containerToAppend.scroll();
                   }
               } else {
                   profilePostsLoading = false;
               }
           }, {containerToAppend:containerToAppend, count:count} );
    }
}

function newPostMsg(msg, $postOrig) {
    if( lastPostId != undefined ) {
        if ( typeof _sendedPostIDs !== 'undefined' )
            _sendedPostIDs.push(lastPostId + 1);

        var params = [defaultScreenName, lastPostId + 1, msg]
        if( $postOrig.length ) {
            params.push($postOrig.attr('data-screen-name'));
            params.push(parseInt($postOrig.attr('data-id')));
        }
        freechRpc("newpostmsg", params,
                   function(arg, ret) { incLastPostId(); }, null,
                   function(arg, ret) { var msg = ("message" in ret) ? ret.message : ret;
                                        alert(polyglot.t("ajax_error", { error: msg })); }, null);
    } else {
        alert(polyglot.t("Internal error: lastPostId unknown (following yourself may fix!)"));
    }
}

function newRtMsg(postData, msg) {
    var userpost = $.evalJSON(postData.attr('data-content_to_rt'));
    var sig_userpost;

    if (userpost.rt) {
        if (parseInt(freechVersion) <= 93000) {
            alertPopup({
                //txtTitle: polyglot.t(''), add some title (not 'error', please) or just KISS
                txtMessage: 'Can\'t handle refreeching of commented refreeched freechs —\n'
                    + polyglot.t('daemon_is_obsolete', {versionReq: '0.9.3+'})
            });

            return;
        } else {
            // dropping of rt to avoid overquoting
            sig_userpost = userpost.sig_wort;
            userpost.rt = undefined;
            userpost.sig_rt = undefined;
        }
    } else {
        sig_userpost = postData.attr('data-content_to_sigrt');
    }

    if (typeof sig_userpost === 'undefined') {
        alert(polyglot.t('error',
            {error: 'can\'t sig_userpost is not deifned'}
        ));

        return;
    }

    userpost.sig_wort = undefined;

    var rtObj = {sig_userpost: sig_userpost, userpost: userpost};

    if (typeof lastPostId !== 'undefined') {
        if (typeof _sendedPostIDs !== 'undefined')
            _sendedPostIDs.push(lastPostId + 1);

        var params = [defaultScreenName, lastPostId + 1, rtObj];

        if (typeof msg !== 'undefined')
            params.push(msg);

        freechRpc('newrtmsg', params,
            function(arg, ret) {incLastPostId();}, null,
            function(arg, ret) {var msg = ('message' in ret) ? ret.message : ret;
                alert(polyglot.t('ajax_error', {error: msg}));
            }, null
        );
    } else {
        alert(polyglot.t('Internal error: lastPostId unknown (following yourself may fix!)'));
    }
}

function newFavMsg(postData, priv, msg) {
    var userpost = $.evalJSON(postData.attr('data-content_to_rt'));
    var sig_userpost = postData.attr('data-content_to_sigrt');

    if (typeof sig_userpost === 'undefined') {
        alert(polyglot.t('error',
            {error: 'can\'t sig_userpost is not deifned'}
        ));

        return;
    }
    var rtObj = {sig_userpost: sig_userpost, userpost: userpost};

    if (typeof lastPostId !== 'undefined') {
        if (typeof _sendedPostIDs !== 'undefined')
            _sendedPostIDs.push(lastPostId + 1);

        var params = [defaultScreenName, lastPostId + 1, rtObj, priv];

        if (typeof msg !== 'undefined')
            params.push(msg);

        freechRpc('newfavmsg', params,
            function(arg, ret) {incLastPostId();}, null,
            function(arg, ret) {var msg = ('message' in ret) ? ret.message : ret;
                alert(polyglot.t('ajax_error', {error: msg}));
            }, null
        );
    } else {
        alert(polyglot.t('Internal error: lastPostId unknown (following yourself may fix!)'));
    }
}

function newShortURI(uri, cbFunc, cbReq) {
    if (!uri || !defaultScreenName) return;
    if (parseInt(freechVersion) < 93500) {
        console.warn('can\'t shorten URI "' + uri + '" — '
            + polyglot.t('daemon_is_obsolete', {versionReq: '0.9.35'}));
        return;
    }

    for (var short in freech.URIs)
        if (freech.URIs[short] instanceof Array ?
            freech.URIs[short][0] === uri : freech.URIs[short] === uri) {
            if (typeof cbFunc === 'function')
                cbFunc(uri, short, cbReq);

            return;
        }

    freechRpc('newshorturl', [defaultScreenName, lastPostId + 1, uri],
        function (req, ret) {
            if (ret) {
                ret = ret[0];  // FIXME there should be 1 element anyway for daemon version 93500
                freech.URIs[ret] = req.uri;
                $.localStorage.set('freechaURIs', freech.URIs);
                incLastPostId();
            } else
                console.warn('RPC "newshorturl" error: empty response');

            if (typeof req.cbFunc === 'function')
                req.cbFunc(req.uri, ret, req.cbReq);
        }, {uri: uri, cbFunc: cbFunc, cbReq: cbReq},
        function (req, ret) {
            console.warn('RPC "newshorturl" error: ' + (ret && ret.message ? ret.message : ret));
            if (typeof req.cbFunc === 'function')
                req.cbFunc(req.uri, ret, req.cbReq);
        }, {uri: uri, cbFunc: cbFunc, cbReq: cbReq}
    );
}

function updateProfileData(profileModalContent, username) {

    //profileModalContent.find("a").attr("href",$.MAL.userUrl(username));
    profileModalContent.filter(".profile-card").attr("data-screen-name", username);
    profileModalContent.find(".profile-screen-name b").text(username);
    profileModalContent.find("a.follow").attr("href", $.MAL.followUrl(username));
    profileModalContent.find("a.direct-messages-with-user").attr("href", $.MAL.dmchatUrl(username));
    profileModalContent.find("a.new-post-to").attr("href", $.MAL.newPostToUrl(username));
    profileModalContent.find("a.mentions-from-user").attr("href", $.MAL.mentionsUrl(username));
    getFullname( username, profileModalContent.find(".profile-name") );
    getLocation( username, profileModalContent.find(".profile-location") );
    getWebpage( username, profileModalContent.find(".profile-url") );
    getBioToElem(username, profileModalContent.find('.profile-bio'));
    getTox( username, profileModalContent.find(".profile-tox") );
    getBitmessage( username, profileModalContent.find(".profile-bitmessage") );
    getAvatar( username, profileModalContent.find(".profile-card-photo") );
    getPostsCount( username,  profileModalContent.find(".posts-count") );
    getFollowers( username, profileModalContent.find(".followers-count") );
    getNumFollowing( username, profileModalContent.find(".following-count") );
    getWhoFollows ( username, profileModalContent.find(".who-follow") );

    profileModalContent.find(".following-count").parent().attr("href", $.MAL.followingUrl(username));

    var postsView = profileModalContent.find(".postboard-posts");

    // try using getposts first. fallback to dht.
    freechRpc("getposts", [1,[{username: username}]],
                       function(args, posts) {
                           updateProfilePosts(postsView, username, posts.length);
                       }, {},
                       function(args, ret) {
                           updateProfilePosts(postsView, username, false);
                       }, {});
}

function updateProfilePosts(postsView, username, useGetposts) {
    requestPostRecursively(postsView,username,"status",postsPerRefresh, useGetposts);

    postsView.scroll(function(){
        if (!profilePostsLoading) {
            var $this = $(this);
            if ($this.scrollTop() >= this.scrollHeight - $this.height() - 20) {
                requestPostRecursively($this,username,"",postsPerRefresh, useGetposts);
            }
        }
     });
}

function queryCreateRes(query, resource, extra) {
    var req = query + '@' + resource;
    freech.res[req] = {
        query: query,
        resource: resource,
        lengthCached: 0,
        freechs: {
            cached: {},
            pending: []
        }
    };
    if (extra)
        for (i in extra)
            freech.res[req][i] = extra[i];

    return freech.res[req];
}

function queryStart(board, query, resource, timeoutArgs, intervalTimeout, extra) {
    var req = query + '@' + resource;

    if (typeof freech.res[req] !== 'object') {
        freech.res[req] = {
            board: board,
            query: query,
            resource: resource,
            lengthCached: 0,
            freechs: {
                cached: {},
                pending: []
            }
        };
        if (extra) {
            for (i in extra)
                freech.res[req][i] = extra[i];

            if (typeof extra.ready === 'function')
                extra.ready(req, extra.readyReq);
        }
    } else {
        freech.res[req].board = board;
        for (var i in freech.res[req].freechs.cached)
            if (freech.res[req].freechs.pending.indexOf(i) === -1)
                freech.res[req].freechs.pending.push(i);

        if (extra) {
            if (typeof extra.drawFinish === 'function') {
                freech.res[req].drawFinish = extra.drawFinish;
                freech.res[req].drawFinishReq = extra.drawFinishReq;
            }
            if (typeof extra.skidoo === 'function')
                freech.res[req].skidoo = extra.skidoo;
        }

        queryPendingDraw(req);
    }

    if (freech.res[req].interval)
        return req;

    queryRequest(req);

    // use extended timeout parameters on modal refresh (requires freech_core >= 0.9.14).
    // our first query above should be faster (with default timeoutArgs of freechd),
    // then we may possibly collect more posts on our second try by waiting more.
    freech.res[req].timeoutArgs = timeoutArgs ? timeoutArgs : [10000, 2000, 3];

    freech.res[req].interval = setInterval(queryTick, intervalTimeout ? intervalTimeout : 5000, req);

    return req;
}

function queryTick(req) {
    if (typeof freech.res[req].skidoo === 'function' ? freech.res[req].skidoo(req)
        : !isModalWithElemExists(freech.res[req].board)) {
        clearInterval(freech.res[req].interval);
        freech.res[req].interval = 0;
        queryPendingClear(req);
        return;
    }

    queryRequest(req);
}

function queryPendingClear(req) {
    freech.res[req].freechs.pending = [];
}

function queryRequest(req) {
    if (freech.res[req].board && isModalWithElemExists(freech.res[req].board))
        freech.res[req].board.closest('div').find('.postboard-loading').show();

    if (freech.res[req].resource === 'mention' && freech.res[req].query === defaultScreenName) {
        freechRpc('getmentions', [freech.res[req].query, 100, {since_id: freech.res[req].lastTorrentId}],
            queryProcess, req,
            function () {console.warn('getmentions API requires freech-core > 0.9.27');}
        );
        dhtget(freech.res[req].query, freech.res[req].resource, 'm',
            queryProcess, req, freech.res[req].timeoutArgs);
    } else if (freech.res[req].resource === 'fav')
        freechRpc('getfavs', [freech.res[req].query, 1000],
            queryProcess, req);
    else if (freech.res[req].resource === 'direct') {
        var lengthStandard = 100;  // FIXME there may be the gap between .lastId and the lesser freech.id in response greater than 100 (very rare case)
        if (freech.res[req].lengthCached < Math.min(freech.res[req].lastId, lengthStandard)
            && !freech.res[req].triedToReCache) {
            freech.res[req].triedToReCache = true;
            var length = Math.min(freech.res[req].lastId + 1, lengthStandard);
            var query = [{username: freech.res[req].query, max_id: freech.res[req].lastId}];
        } else
            var length = lengthStandard, query = [{username: freech.res[req].query, since_id: freech.res[req].lastId}];

        freechRpc('getdirectmsgs', [defaultScreenName, length, query],
            queryProcess, req,
            function (req, res) {
                console.warn(polyglot.t('ajax_error', {error: (res && res.message) ? res.message : res}));
            }
        );
    } else
        dhtget(freech.res[req].query, freech.res[req].resource, 'm',
            queryProcess, req, freech.res[req].timeoutArgs);
}

function queryProcess(req, res) {
    if (!req || !freech.res[req] || typeof res !== 'object' || $.isEmptyObject(res))
        return;

    var lengthNew = 0;
    var lengthPending = freech.res[req].freechs.pending.length;

    if (freech.res[req].resource === 'mention' && freech.res[req].query === defaultScreenName)
        lengthNew = queryPendingPushMentions(req, res);
    else if (freech.res[req].resource === 'direct')
        lengthNew = queryPendingPushDMs(res);
    else
        lengthNew = queryPendingPush(req, res);

    if (typeof freech.res[req].skidoo === 'function' && freech.res[req].skidoo(req))
        return;

    if (lengthNew) {
        if (freech.res[req].resource === 'mention' && freech.res[req].query === defaultScreenName) {
            $.MAL.updateNewMentionsUI(freech.res[req].lengthNew);
            $.MAL.soundNotifyMentions();
            if (!$.mobile && $.Options.showDesktopNotifMentions.val === 'enable')
                $.MAL.showDesktopNotification({
                    body: polyglot.t('You got') + ' ' + polyglot.t('new_mentions', freech.res[req].lengthNew) + '.',
                    tag: 'freech_notification_new_mentions',
                    timeout: $.Options.showDesktopNotifMentionsTimer.val,
                    funcClick: (function () {
                        if (!freech.res[this.req].board || !focusModalWithElement(freech.res[this.req].board,
                            function (req) {
                                freech.res[req].board.closest('.postboard')
                                    .find('.postboard-news').click();
                            },
                            this.req
                        ))
                            $.MAL.showMentions(defaultScreenName);
                    }).bind({req: req})
                });
        } else if (freech.res[req].resource === 'direct') {
            if (freech.res[req].query[0] !== '*')
                $.MAL.updateNewDMsUI(getNewDMsCount());
            else
                $.MAL.updateNewGroupDMsUI(getNewGroupDMsCount());

            $.MAL.soundNotifyDM();
            if (!$.mobile && $.Options.showDesktopNotifDMs.val === 'enable')
                $.MAL.showDesktopNotification({
                    body: freech.res[req].query[0] === '*' ?
                        polyglot.t('You got') + ' ' + polyglot.t('new_group_messages', getNewGroupDMsCount()) + '.'
                        : polyglot.t('You got') + ' ' + polyglot.t('new_direct_messages', getNewDMsCount()) + '.',
                    tag: 'freech_notification_new_DMs',
                    timeout: $.Options.showDesktopNotifDMsTimer.val,
                    funcClick: (function () {
                        focusModalWithElement(freech.res[this.req].board);
                    }).bind({req: req})
                });
            // TODO new DMs counters on minimized modals'
        } else if (!$.mobile && $.Options.showDesktopNotifPostsModal.val === 'enable'
            && (freech.res[req].resource !== 'mention' || freech.res[req].query !== defaultScreenName)
            && freech.res[req].board && isModalWithElemExists(freech.res[req].board)
            && freech.res[req].board.children().length)
            $.MAL.showDesktopNotification({
                body: polyglot.t('You got') + ' ' + polyglot.t('new_posts', freech.res[req].freechs.pending.length) + ' '
                    + polyglot.t('in search result') + '.',
                tag: 'freech_notification_new_posts_modal',
                timeout: $.Options.showDesktopNotifPostsModalTimer.val,
                funcClick: (function () {
                    focusModalWithElement(freech.res[this.req].board,
                        function (req) {
                            freech.res[req].board.closest('.postboard')
                                .find('.postboard-news').click();
                        },
                        this.req
                    );
                }).bind({req: req})
            });
    }

    if (freech.res[req].freechs.pending.length > lengthPending) {  // there is some freechs may be which are not considered new so lengthNew equals zero (mentions thing)
        if (!freech.res[req].board || (!$.mobile && !isModalWithElemExists(freech.res[req].board)))
            return;

        if (!freech.res[req].board.children().length || freech.res[req].boardAutoAppend)
            queryPendingDraw(req);
        else {
            freech.res[req].board.closest('div').find('.postboard-news')  // FIXME we'd replace 'div' with '.postboard' but need to dig through tmobile first
                .text(polyglot.t('new_posts', freech.res[req].freechs.pending.length))
                .fadeIn('slow')
            ;
            freech.res[req].board.closest('div').find('.postboard-loading').hide();
        }
    }
}

function queryPendingPush(req, freechs) {
    var lengthNew = 0;
    var needForFilter = $.Options.filterLang.val !== 'disable' && $.Options.filterLangForSearching.val;

    for (var i = freechs.length - 1; i >= 0; i--) {
        var userpost = freechs[i].userpost;
        var j = userpost.n + '/' + userpost.time;

        if (typeof freech.res[req].freechs.cached[j] === 'undefined') {
            if (userpost.fav)
                userpost = userpost.fav;

            if ((typeof userpost.msg !== 'string' || userpost.msg === '')
                && (typeof userpost.rt !== 'object'
                    || typeof userpost.rt.msg !== 'string' || userpost.rt.msg === ''))
                continue;

            if (needForFilter) {
                if (typeof userpost.msg === 'string' && userpost.msg !== '')
                    langFilterData = filterLang(userpost.msg);
                else
                    langFilterData = filterLang(userpost.rt.msg);

                if ($.Options.filterLangSimulate.val) {
                    freechs[i].langFilter = langFilterData;
                } else {
                    if (!langFilterData.pass)
                        continue;
                }
            }

            lengthNew++;
            freech.res[req].freechs.cached[j] = freechs[i];
            freech.res[req].lengthCached++;
            freech.res[req].freechs.pending.push(j);
        }
    }

    return lengthNew;
}

function queryPendingDraw(req) {
    var freechs = [], length = 0;

    if (freech.res[req].resource === 'direct') {
        for (var j = 0; j < freech.res[req].freechs.pending.length; j++) {
            var freech = freech.res[req].freechs.cached[freech.res[req].freechs.pending[j]];
            for (var i = 0; i < length; i++)
                if (freech.id < freechs[i].id) {
                    freechs.splice(i, 0, freech);
                    break;
                }

            if (length === freechs.length)
                freechs.push(freech);

            length++;
        }
        attachPostsToStream(freech.res[req].board, freechs, false,
            function (freech, req) {
                return {item: postToElemDM(freech, req.peerAliasLocal, req.peerAliasRemote)
                    .attr('data-id', freech.id), time: freech.time};
            },
            {peerAliasLocal: defaultScreenName, peerAliasRemote: freech.res[req].query}
        );
        resetNewDMsCountForPeer(freech.res[req].query);
    } else {
        for (var j = 0; j < freech.res[req].freechs.pending.length; j++) {
            var freech = freech.res[req].freechs.cached[freech.res[req].freechs.pending[j]];
            for (var i = 0; i < length; i++)
                if (freech.userpost.time > freechs[i].userpost.time) {
                    freechs.splice(i, 0, freech);
                    break;
                }

            if (length === freechs.length)
                freechs.push(freech);

            length++;
        }
        attachPostsToStream(freech.res[req].board, freechs, true,
            function (freech) {
                return {item: postToElem(freech, 'original'), time: freech.userpost.time};
            }
        );
        if (freech.res[req].resource === 'mention' && freech.res[req].query === defaultScreenName)
            resetMentionsCount();
    }

    queryPendingClear(req);

    if (typeof freech.res[req].drawFinish === 'function')
        freech.res[req].drawFinish(req, freech.res[req].drawFinishReq);
    else
        $.MAL.postboardLoaded();
}
