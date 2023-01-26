// freech_newmsgs.js
// 2013 Miguel Freitas
//
// Periodically check for new mentions and private messages (DMs)
// Update UI counters in top bar. Load/save state to localStorage.

// --- mentions ---

var groupChatAliases = []

function saveMentionsToStorage() {
    var freechs = [], length = 0;
    for (var j in freech.mentions.freechs.cached) {
        for (var i = 0; i < length; i++)
            if (freech.mentions.freechs.cached[j].userpost.time > freechs[i].userpost.time) {
                freechs.splice(i, 0, freech.mentions.freechs.cached[j]);
                break;
            }

        if (length === freechs.length)
            freechs.push(freech.mentions.freechs.cached[j]);

        length++;
    }

    $.initNamespaceStorage(defaultScreenName).localStorage
        .set('mentions', {
            freechs: freechs.slice(0, 100),  // TODO add an option to specify number of mentions to cache
            lastTime: freech.mentions.lastTime,
            lastTorrentId: freech.mentions.lastTorrentId
        })
    ;
}

function loadMentionsFromStorage() {
    var storage = $.initNamespaceStorage(defaultScreenName).localStorage;

    if (storage.isSet('mentions')) {
        var mentions = storage.get('mentions');
        if (typeof mentions === 'object') {
            for (var i = 0; i < mentions.freechs.length; i++) {
                var j = mentions.freechs[i].userpost.n + '/' + mentions.freechs[i].userpost.time;
                if (typeof freech.mentions.freechs.cached[j] === 'undefined') {
                    freech.mentions.freechs.cached[j] = mentions.freechs[i];
                    freech.mentions.lengthCached++;
                    if (freech.mentions.freechs.cached[j].isNew)
                        freech.mentions.lengthNew++;

                    freech.mentions.lengthFromTorrent++;
                }
            }
            freech.mentions.lastTime = mentions.lastTime;
            freech.mentions.lastTorrentId = mentions.lastTorrentId;
        }
    }

    // WARN all following storage keys are deprecated (see commit dc8cfc20ef10ff3008b4abfdb30d31e7fcbec0cd)
    if (storage.isSet('knownMentions')) {
        var mentions = storage.get('knownMentions');
        if (typeof mentions === 'object')
            for (var i in mentions) {
                var j = mentions[i].data.userpost.n + '/' + mentions[i].mentionTime;
                if (typeof freech.mentions.freechs.cached[j] === 'undefined') {
                    freech.mentions.freechs.cached[j] = mentions[i].data;
                    freech.mentions.lengthCached++;
                    if (freech.mentions.freechs.cached[j].isNew)
                        freech.mentions.lengthNew++;

                    freech.mentions.lengthFromTorrent++;
                }
            }

        storage.remove('knownMentions');
    }
    if (storage.isSet('lastMentionTime')) {
        freech.mentions.lastTime = storage.get('lastMentionTime');
        storage.remove('lastMentionTime');
    }
    if (storage.isSet('lastLocalMentionId')) {
        freech.mentions.lastTorrentId = storage.get('lastLocalMentionId');
        storage.remove('lastLocalMentionId');
    }
    if (storage.isSet('newMentions'))
        storage.remove('newMentions');
}

function queryPendingPushMentions(req, res) {
    var lengthNew = 0;
    var lengthPending = freech.res[req].freechs.pending.length;
    var timeCurrent = new Date().getTime() / 1000 + 7200;  // 60 * 60 * 2
    var timeLastMention = freech.res[req].lastTime;

    for (var i = 0; i < res.length; i++) {
        if (res[i].userpost.time > timeCurrent) {
            console.warn('ignoring mention from the future:');
            console.log(res[i]);
            continue;
        }

        if (res[i].id) {
            freech.res[req].lastTorrentId = Math.max(freech.res[req].lastTorrentId, res[i].id);
            delete res[i].id;
            freech.res[req].lengthFromTorrent++;
        }

        var j = res[i].userpost.n + '/' + res[i].userpost.time;
        if (typeof freech.res[req].freechs.cached[j] === 'undefined') {
            freech.res[req].freechs.cached[j] = res[i];
            freech.res[req].lengthCached++;
            freech.res[req].freechs.pending.push(j);

            // mention must be somewhat recent compared to last known one to be considered new
            if (res[i].userpost.time + 259200 > timeLastMention) {  // 3600 * 24 * 3
                lengthNew++;
                freech.res[req].lastTime = Math.max(res[i].userpost.time, freech.res[req].lastTime);
                freech.res[req].freechs.cached[j].isNew = true;
            }
        }
    }

    if (lengthNew)
        freech.res[req].lengthNew += lengthNew;

    if (freech.res[req].freechs.pending.length > lengthPending)
        saveMentionsToStorage();

    return lengthNew;
}

function resetMentionsCount() {
    if (!freech.mentions.lengthNew)
        return;

    freech.mentions.lengthNew = 0;

    for (var j in freech.mentions.freechs.cached)
        if (freech.mentions.freechs.cached[j].isNew)
            delete freech.mentions.freechs.cached[j].isNew;

    saveMentionsToStorage();
    $.MAL.updateNewMentionsUI(freech.mentions.lengthNew);
}

function initMentionsCount() {
    var req = queryStart('', defaultScreenName, 'mention', [10000, 2000, 3], 10000, {
        lastTime: 0,
        lastTorrentId: -1,
        lengthNew: 0,
        ready: function (req) {
            freech.mentions = freech.res[req];
            freech.mentions.lengthFromTorrent = 0;
            loadMentionsFromStorage();
        },
        skidoo: function () {return false;}
    });

    $.MAL.updateNewMentionsUI(freech.mentions.lengthNew);
}

function handleMentionsModalScroll(event) {
    if (!event || freech.mentions.scrollQueryActive)
        return;

    var elem = $(event.target);
    if (elem.scrollTop() >= elem[0].scrollHeight - elem.height() - 50) {
        freech.mentions.scrollQueryActive = true;

        freechRpc('getmentions', [freech.mentions.query, postsPerRefresh,
            {max_id: freech.mentions.lastTorrentId - freech.mentions.lengthFromTorrent}],
            function (req, res) {
                freech.res[req].scrollQueryActive = false;
                freech.res[req].boardAutoAppend = true;  // FIXME all pending freechs will be appended
                queryProcess(req, res);
                freech.res[req].boardAutoAppend = false;
            }, freech.mentions.query + '@' + freech.mentions.resource,
            function () {console.warn('getmentions API requires freech-core > 0.9.27');}
        );
    }
}

// --- direct messages ---

function saveDMsToStorage() {
    var pool = {};

    for (var peerAlias in freech.DMs) {
        var freechs = [], length = 0;
        for (var j in freech.DMs[peerAlias].freechs.cached) {
            for (var i = 0; i < length; i++)
                if (freech.DMs[peerAlias].freechs.cached[j].id > freechs[i].id) {
                    freechs.splice(i, 0, freech.DMs[peerAlias].freechs.cached[j]);
                    break;
                }

            if (length === freechs.length)
                freechs.push(freech.DMs[peerAlias].freechs.cached[j]);

            length++;
        }
        pool[peerAlias] = {
            freechs: freechs.slice(0, 100),  // TODO add an option to specify number of DMs to cache
            lastId: freech.DMs[peerAlias].lastId,
        };
    }

    if ($.Options.get('dmEncryptCache') === 'enable') {
        pool = freech.var.key.pub.encrypt(JSON.stringify(pool));
        delete pool.orig;  // WORKAROUND the decrypt function does .slice(0, orig) but something goes wrong in process of buffer decoding (if original string contains non-ASCII characters) and orig may be smaller than the actual size, if it is undefined .slice gets it whole
    }
    $.initNamespaceStorage(defaultScreenName).localStorage.set('DMs', pool);
}

function loadDMsFromStorage() {
    var storage = $.initNamespaceStorage(defaultScreenName).localStorage;

    if (storage.isSet('DMs')) {
        var pool = storage.get('DMs');
        if (pool.key && pool.body && pool.mac) {
            if (pool = freech.var.key.decrypt(pool))
                pool = JSON.parse(pool.toString());
            else
                console.warn('can\'t decrypt DMs\' data cache');
        }
        if (typeof pool === 'object') {
            for (var peerAlias in pool) {
                if (!freech.DMs[peerAlias])
                    freech.DMs[peerAlias] = queryCreateRes(peerAlias, 'direct',
                        {boardAutoAppend: true, lastId: 0, lengthNew: 0});

                for (var i = 0; i < pool[peerAlias].freechs.length; i++) {
                    var j = pool[peerAlias].freechs[i].from + '/' + pool[peerAlias].freechs[i].time;
                    if (typeof freech.DMs[peerAlias].freechs.cached[j] === 'undefined') {
                        freech.DMs[peerAlias].freechs.cached[j] = pool[peerAlias].freechs[i];
                        freech.DMs[peerAlias].lengthCached++;
                        if (freech.DMs[peerAlias].freechs.cached[j].isNew)
                            freech.DMs[peerAlias].lengthNew++;
                    }
                }
                freech.DMs[peerAlias].lastId = pool[peerAlias].lastId;
            }
        }
    }

    // WARN all following storage keys are deprecated (see commit FIXME)
    if (storage.isSet('lastDMIdPerUser')) {
        var pool = storage.get('lastDMIdPerUser');
        if (typeof pool === 'object')
            for (var peerAlias in pool) {
                if (!freech.DMs[peerAlias])
                    freech.DMs[peerAlias] = queryCreateRes(peerAlias, 'direct',
                        {boardAutoAppend: true, lastId: 0, lengthNew: 0});

                freech.DMs[peerAlias].lastId = pool[peerAlias];
            }

        storage.remove('lastDMIdPerUser');
    }
    if (storage.isSet('newDMsPerUser')) {
        var pool = storage.get('newDMsPerUser');
        if (typeof pool === 'object')
            for (var peerAlias in pool) {
                if (!freech.DMs[peerAlias])
                    freech.DMs[peerAlias] = queryCreateRes(peerAlias, 'direct',
                        {boardAutoAppend: true, lastId: 0, lengthNew: 0});

                freech.DMs[peerAlias].lengthNew = pool[peerAlias];
            }

        storage.remove('newDMsPerUser');
    }
}

function queryPendingPushDMs(res) {
    var lengthNew = 0;
    var lengthPending = 0;

    for (var peerAlias in res) {
        if (!res[peerAlias] || !res[peerAlias].length || !freech.DMs[peerAlias])
            continue;

        for (var i = 0; i < res[peerAlias].length; i++) {
            var j = res[peerAlias][i].from + '/' + res[peerAlias][i].time;
            if (typeof freech.DMs[peerAlias].freechs.cached[j] === 'undefined') {
                freech.DMs[peerAlias].freechs.cached[j] = res[peerAlias][i];
                freech.DMs[peerAlias].lengthCached++;
                freech.DMs[peerAlias].freechs.pending.push(j);
                lengthPending++;
                if (freech.DMs[peerAlias].lastId < res[peerAlias][i].id) {
                    freech.DMs[peerAlias].lastId = res[peerAlias][i].id;
                    if ((!freech.DMs[peerAlias].board || !freech.DMs[peerAlias].board.is('html *'))
                        && !res[peerAlias][i].fromMe && res[peerAlias][i].from !== defaultScreenName) {
                        lengthNew++;
                        freech.DMs[peerAlias].lengthNew += 1;
                        freech.DMs[peerAlias].freechs.cached[j].isNew = true;
                    }
                }
            }
        }
    }

    if (lengthPending)
        saveDMsToStorage();

    return lengthNew;
}

function requestDMsCount() {
    var list = [];
    for (var i = 0; i < followingUsers.length; i++)
        list.push({username: followingUsers[i]});
    for (var i = 0; i < groupChatAliases.length; i++)
        list.push({username: groupChatAliases[i]});

    freechRpc('getdirectmsgs', [defaultScreenName, 1, list],
        function (req, res) {
            var lengthNew = 0, lengthNewMax = 0;
            var list = [];

            for (var peerAlias in res) {
                if (!res[peerAlias] || !res[peerAlias].length)
                    continue;

                if (!freech.DMs[peerAlias])
                    freech.DMs[peerAlias] = queryCreateRes(peerAlias, 'direct',
                        {boardAutoAppend: true, lastId: 0, lengthNew: 0});

                if (res[peerAlias][0].id > freech.DMs[peerAlias].lastId) {
                    lengthNew = res[peerAlias][0].id - freech.DMs[peerAlias].lastId;
                    if (lengthNewMax < lengthNew)
                        lengthNewMax = lengthNew;

                    list.push({username: peerAlias});
                } else if (!freech.DMs[peerAlias].lengthCached)
                    queryPendingPushDMs(res);
            }

            if (list.length === 1)
                queryProcess(list[0].username + '@direct', res);
            else if (lengthNewMax === 1) {
                if (queryPendingPushDMs(res))
                    DMsSummaryProcessNew();
            } else if (lengthNewMax) {
                freechRpc('getdirectmsgs', [defaultScreenName, lengthNewMax, list],
                    function (req, res) {
                        if (typeof res !== 'object' || $.isEmptyObject(res))
                            return;

                        if (queryPendingPushDMs(res))
                            DMsSummaryProcessNew();
                    }, undefined,
                    function (req, res) {
                        console.warn(polyglot.t('ajax_error',
                            {error: (res && res.message) ? res.message : res}));
                    }
                );
            }
        }, undefined,
        function (req, res) {
            console.warn(polyglot.t('ajax_error', {error: (res && res.message) ? res.message : res}));
        }
    );
}

function DMsSummaryProcessNew() {
    var lengthNew = getNewDMsCount();
    if (lengthNew) {
        $.MAL.updateNewDMsUI(lengthNew);
        $.MAL.soundNotifyDM();
        if (!$.mobile) {
            if ($.Options.showDesktopNotifDMs.val === 'enable') {
                $.MAL.showDesktopNotification({
                    body: polyglot.t('You got') + ' ' + polyglot.t('new_direct_messages', lengthNew) + '.',
                    tag: 'freech_notification_new_DMs',
                    timeout: $.Options.showDesktopNotifDMsTimer.val,
                    funcClick: function () {$.MAL.showDMchat();}
                });
            }
            var elem = getElem('.directMessages .direct-messages-list');
            if (isModalWithElemExists(elem))
                modalDMsSummaryDraw(elem);
        } else if ($.mobile.activePage.attr('id') !== 'directmsg')
            modalDMsSummaryDraw($('#directmsg .direct-messages-list'));
    }
    lengthNew = getNewGroupDMsCount();
    if (lengthNew) {
        $.MAL.updateNewGroupDMsUI(lengthNew);
        $.MAL.soundNotifyDM();
        if (!$.mobile) {
            if ($.Options.showDesktopNotifDMs.val === 'enable') {
                $.MAL.showDesktopNotification({
                    body: polyglot.t('You got') + ' ' + polyglot.t('new_group_messages', lengthNew) + '.',
                    tag: 'freech_notification_new_DMs',
                    timeout: $.Options.showDesktopNotifDMsTimer.val,
                    funcClick: function () {$.MAL.showDMchat({group: true});}
                });
            }
            var elem = getElem('.groupMessages .direct-messages-list');
            if (isModalWithElemExists(elem))
                modalDMsSummaryDraw(elem, true);
        } else if ($.mobile.activePage.attr('id') !== 'directmsg')
            modalDMsSummaryDraw($('#directmsg .direct-messages-list'), true);
    }
}

function getNewDMsCount() {
    var lengthNew = 0;

    for (var peerAlias in freech.DMs)
        if (peerAlias[0] !== '*' && freech.DMs[peerAlias].lengthNew)
            lengthNew += freech.DMs[peerAlias].lengthNew;

    return lengthNew;
}

function getNewGroupDMsCount() {
    var lengthNew = 0;

    for (var peerAlias in freech.DMs)
        if (peerAlias[0] === '*' && freech.DMs[peerAlias].lengthNew)
            lengthNew += freech.DMs[peerAlias].lengthNew;

    return lengthNew;
}

function resetNewDMsCount() {
    var isNewDetected;

    for (var peerAlias in freech.DMs)
        if (freech.DMs[peerAlias].lengthNew && peerAlias[0] !== '*') {
            freech.DMs[peerAlias].lengthNew = 0;
            for (var j in freech.DMs[peerAlias].freechs.cached)
                delete freech.DMs[peerAlias].freechs.cached[j].isNew;

            isNewDetected = true;
        }

    if (!isNewDetected)
        return;

    saveDMsToStorage();
    $.MAL.updateNewDMsUI(getNewDMsCount());
}

function resetNewDMsCountGroup() {
    var isNewDetected;

    for (var peerAlias in freech.DMs)
        if (freech.DMs[peerAlias].lengthNew && peerAlias[0] === '*') {
            freech.DMs[peerAlias].lengthNew = 0;
            for (var j in freech.DMs[peerAlias].freechs.cached)
                delete freech.DMs[peerAlias].freechs.cached[j].isNew;

            isNewDetected = true;
        }

    if (!isNewDetected)
        return;

    saveDMsToStorage();
    $.MAL.updateNewGroupDMsUI(getNewGroupDMsCount());
}

function resetNewDMsCountForPeer(peerAlias) {
    if (!freech.DMs[peerAlias].lengthNew)
        return;

    freech.DMs[peerAlias].lengthNew = 0;
    for (var j in freech.DMs[peerAlias].freechs.cached)
        delete freech.DMs[peerAlias].freechs.cached[j].isNew;

    saveDMsToStorage();
    if (peerAlias[0] !== '*')
        $.MAL.updateNewDMsUI(getNewDMsCount());
    else
        $.MAL.updateNewGroupDMsUI(getNewGroupDMsCount());
}

function updateGroupList() {
    freechRpc('listgroups', [],
        function(req, ret) {groupChatAliases = ret;}, null,
        function(req, ret) {console.warn('freechd >= 0.9.30 required for listgroups');}, null
    );
}

function initDMsCount() {
    freech.DMs = {};
    dumpPrivkey(defaultScreenName, function (req, res) {
        freech.var.key = FreechCrypto.PrivKey.fromWIF(res);

        loadDMsFromStorage();
        $.MAL.updateNewDMsUI(getNewDMsCount());
        $.MAL.updateNewGroupDMsUI(getNewGroupDMsCount());
        //quick hack to obtain list of group chat aliases
        updateGroupList();
        setInterval(updateGroupList, 60000);

        setTimeout(requestDMsCount, 200);
        //polling not needed: processNewPostsConfirmation will call requestDMsCount.
        //setInterval('requestDMsCount()', 5000);
    });
}

function newmsgsChangedUser() {
    clearInterval(freech.mentions.interval);
}

function handleDMsModalScroll(event) {
    if (!event || !event.data.req || !freech.DMs[event.data.req]
        || freech.DMs[event.data.req].scrollQueryActive)
        return;

    var length = freech.DMs[event.data.req].lastId - freech.DMs[event.data.req].lengthCached + 1;
    if (!length)
        return;

    var elem = $(event.target);
    if (elem.scrollTop() < 100) {
        freech.DMs[event.data.req].scrollQueryActive = true;

        freechRpc('getdirectmsgs', [defaultScreenName, Math.min(length, postsPerRefresh),
            [{username: freech.DMs[event.data.req].query, max_id: length - 1}]],
            function (req, res) {
                freech.res[req.k].scrollQueryActive = false;
                //freech.res[req.k].boardAutoAppend = true;  // FIXME all pending freechs will be appended
                queryProcess(req.k, res);
                //freech.res[req.k].boardAutoAppend = false;
                if (req.container[0].scrollHeight !== req.containerScrollHeightPrev)
                    req.container.scrollTop(req.container[0].scrollHeight - req.containerScrollHeightPrev);
            }, {
                k: freech.DMs[event.data.req].query + '@' + freech.DMs[event.data.req].resource,
                container: elem,
                containerScrollHeightPrev: elem[0].scrollHeight
            },
            function (req, res) {
                console.warn(polyglot.t('ajax_error',
                    {error: (res && res.message) ? res.message : res}));
            }
        );
    }
}
