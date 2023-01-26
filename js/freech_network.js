// freech_network.js
// 2013 Miguel Freitas
//
// Provides functions for periodic network status check
// Interface to network.html page.

var freechVersion;
var freechDisplayVersion;
var freechdConnections = 0;
var freechdAddrman = 0;
var freechDhtNodes = 0;
var freechdBlocks = 0;
var freechdLastBlockTime = 0;
var freechdConnectedAndUptodate = false;
var genproclimit = 1;

// ---

function formatDecimal(value) {
    if (!value) return '0';
    var exponent = Math.floor(Math.log(value) / Math.LN10),
        scale = (exponent < 2) ? Math.pow(10, 2 - exponent) : 1;
    return Math.round(value * scale) / scale;
}
function formatSize(value) {
    if (value<1024) return value + ' B';
    if (value<1024*1024) return formatDecimal(value/1024) + ' KB';
    if (value<1024*1024*1024) return formatDecimal(value/(1024*1024)) + ' MB';
    if (value<1024*1024*1024*1024) return formatDecimal(value/(1024*1024*1024)) + ' GB';
    return formatDecimal(value/(1024*1024*1024*1024)) + ' TB';
}
function formatSpeed(total, rate) {
    return formatSize(total) + ' @ ' + formatSize(rate) + '/s'
}

function requestNetInfo(cbFunc, cbArg) {
    freechRpc("getinfo", [],
               function(args, ret) {
                   freechdConnections = ret.connections;
                   freechdAddrman     = ret.addrman_total;
                   freechdBlocks      = ret.blocks;
                   freechDhtNodes     = ret.dht_nodes;
                   freechVersion      = ("0000000" + ret.version).slice(-8);
                   freechDisplayVersion = freechVersion.slice(0,2) + '.' +
                                           freechVersion.slice(2,4) + '.' +
                                           freechVersion.slice(4,6) + '.' +
                                           freechVersion.slice(6,8);

                   $(".connection-count").text(freechdConnections);
                   $(".known-peers").text(freechdAddrman);
                   $(".blocks").text(freechdBlocks);
                   $(".dht-nodes").text(freechDhtNodes);
                   $(".userMenu-dhtindicator a").text(freechDhtNodes);
                   $(".version").text(freechDisplayVersion);

                   if( ret.proxy !== undefined && ret.proxy.length ) {
                       $(".proxy").text(ret.proxy);
                       $(".using-proxy").show();
                       $(".not-using-proxy").hide();
                   } else {
                       $(".ext-ip").text(ret.ext_addr_net1);
                       $(".ext-port1").text(ret.ext_port1);
                       $(".ext-port2").text(ret.ext_port2);
                       $(".test-ext-port1").attr("href","http://www.yougetsignal.com/tools/open-ports/?port=" + ret.ext_port1);
                       $(".test-ext-port2").attr("href","http://www.yougetsignal.com/tools/open-ports/?port=" + ret.ext_port2);
                       $(".using-proxy").hide();
                       $(".not-using-proxy").show();
                   }

                   $(".dht-torrents").text(ret.dht_torrents);
                   $(".num-peers").text(ret.num_peers);
                   $(".peerlist-size").text(ret.peerlist_size);
                   $(".num-active-requests").text(ret.num_active_requests);

                   $(".download-rate").text(formatSpeed(ret.total_download, ret.download_rate));
                   $(".upload-rate").text(formatSpeed(ret.total_upload, ret.upload_rate));
                   $(".dht-download-rate").text(formatSpeed(ret.total_dht_download, ret.dht_download_rate));
                   $(".dht-upload-rate").text(formatSpeed(ret.total_dht_upload, ret.dht_upload_rate));
                   $(".ip-overhead-download-rate").text(formatSpeed(ret.total_ip_overhead_download, ret.ip_overhead_download_rate));
                   $(".ip-overhead-upload-rate").text(formatSpeed(ret.total_ip_overhead_upload, ret.ip_overhead_upload_rate));
                   $(".payload-download-rate").text(formatSpeed(ret.total_payload_download, ret.payload_download_rate));
                   $(".payload-upload-rate").text(formatSpeed(ret.total_payload_upload, ret.payload_upload_rate));

                   if( !freechdConnections ) {
                       $.MAL.setNetworkStatusMsg(polyglot.t("Connection lost."), false);
                       freechdConnectedAndUptodate = false;
                   }

                   if( args.cbFunc )
                       args.cbFunc(args.cbArg);
               }, {cbFunc:cbFunc, cbArg:cbArg},
               function(args, ret) {
                   console.log("Error connecting to local freech daemon.");
               }, {});
}

function peerKeypress() {
    var peer = $(".new-peer-addr").val();
    var $button = $(".add-peer");
    if( peer.length ) {
        $.MAL.enableButton( $button );
    } else {
        $.MAL.disableButton( $button );
    }
}

function dnsKeypress() {
    var peer = $(".new-dns-addr").val();
    var $button = $(".add-dns");
    if( peer.length ) {
        $.MAL.enableButton( $button );
    } else {
        $.MAL.disableButton( $button );
    }
}

function addPeerClick() {
    var peer = $(".new-peer-addr").val();
    freechRpc("addnode", [peer, "onetry"],
               function(args, ret) {
                   $(".new-peer-addr").val("")
               }, {},
               function(args, ret) {
                   alert(polyglot.t("error", { error: ret.message }));
               }, {});
}

function addDNSClick() {
    var dns = $(".new-dns-addr").val();
    freechRpc("adddnsseed", [dns],
               function(args, ret) {
                   $(".new-dns-addr").val("")
               }, {},
               function(args, ret) {
                   alert(polyglot.t("error", { error: ret.message }));
               }, {});
}

function requestBestBlock(cbFunc, cbArg) {
    freechRpc("getbestblockhash", [],
               function(args, hash) {
                   requestBlock(hash, args.cbFunc, args.cbArg);
               }, {cbFunc:cbFunc, cbArg:cbArg},
               function(args, ret) {
                   console.log("getbestblockhash error");
               }, {});
}

function requestNthBlock(n, cbFunc, cbArg) {
    freechRpc("getblockhash", [n],
        function(args, hash) {
            requestBlock(hash, args.cbFunc, args.cbArg);
        }, {cbFunc:cbFunc, cbArg:cbArg},
        function(args, ret) {
            console.log("getblockhash error");
        }, {});
}

function requestBlock(hash, cbFunc, cbArg) {
    freechRpc("getblock", [hash],
               function(args, block) {
                   if( args.cbFunc )
                       args.cbFunc(block, args.cbArg);
               }, {cbFunc:cbFunc, cbArg:cbArg},
               function(args, ret) {
                   console.log("requestBlock error");
               }, {});
}

function networkUpdate(cbFunc, cbArg) {
    requestNetInfo(function () {
        requestBestBlock(function(block, args) {

            freechdLastBlockTime = block.time;
            $(".last-block-time").text(timeGmtToText(freechdLastBlockTime));

            var curTime = new Date().getTime() / 1000;
            if (freechdConnections) {
                if (freechdLastBlockTime > curTime + 3600) {
                    $.MAL.setNetworkStatusMsg(polyglot.t("Last block is ahead of your computer time, check your clock."), false);
                    freechdConnectedAndUptodate = false;
                } else if (freechdLastBlockTime > curTime - (2 * 3600)) {
                    if (freechDhtNodes) {
                        $.MAL.setNetworkStatusMsg(polyglot.t("Block chain is up-to-date, freech is ready to use!"), true);
                        freechdConnectedAndUptodate = true;
                    } else {
                        $.MAL.setNetworkStatusMsg(polyglot.t("DHT network down."), false);
                        freechdConnectedAndUptodate = true;
                    }
                } else {
                    var daysOld = (curTime - freechdLastBlockTime) / (3600 * 24);
                    $.MAL.setNetworkStatusMsg(polyglot.t("downloading_block_chain", {days: daysOld.toFixed(2)}), false);
                    // don't alarm user if blockchain is just a little bit behind
                    freechdConnectedAndUptodate = (daysOld < 2);
                }
            }
            if (args.cbFunc)
                args.cbFunc(args.cbArg);
        }, {cbFunc:cbFunc, cbArg:cbArg} );
    });
}

function getMiningInfo(cbFunc, cbArg) {
    freechRpc("getmininginfo", [],
               function(args, ret) {
                   miningDifficulty    = ret.difficulty;
                   miningHashRate      = ret.hashespersec;
                   genproclimit        = ret.genproclimit;

                   $(".mining-difficulty").text(miningDifficulty);
                   $(".mining-hashrate").text(miningHashRate);
/*
                   if( !freechdConnections ) {
                       $.MAL.setNetworkStatusMsg("Connection lost.", false);
                       freechdConnectedAndUptodate = false;
                   }
*/
                   if( args.cbFunc )
                       args.cbFunc(args.cbArg);
               }, {cbFunc:cbFunc, cbArg:cbArg},
               function(args, ret) {
                   console.log("Error connecting to local freech daemon.");
               }, {});
}

function miningUpdate(cbFunc, cbArg) {
    getMiningInfo(cbFunc, cbArg);
}

function getGenerate() {
    freechRpc("getgenerate", [],
               function(args, ret) {
                   var $genblock = $("select.genblock");
                   if( ret ) {
                       $genblock.val("enable");
                   } else {
                       $genblock.val("disable");
                   }
               }, {},
               function(args, ret) {
                   console.log("getgenerate error");
               }, {});
}

function setGenerate() {
    var params = [];
    params.push($("select.genblock").val() == "enable");
    params.push(parseInt($(".genproclimit").val()));
    freechRpc("setgenerate", params,
               function(args, ret) {
                   console.log("setgenerate updated");
               }, {},
               function(args, ret) {
                   console.log("getgenerate error");
               }, {});
}

function getSpamMsg() {
    freechRpc("getspammsg", [],
               function(args, ret) {
                   var $postArea = $(".spam-msg");
                   var $localUsersList = $("select.local-usernames.spam-user");
                   $postArea.val(ret[1]);
                   $localUsersList.val(ret[0]);
               }, {},
               function(args, ret) {
                   console.log("getgenerate error");
               }, {});
}

function setSpamMsg(event) {
    event.stopPropagation();
    event.preventDefault();

    var btnUpdate = $(event.target);
    $.MAL.disableButton(btnUpdate);

    var params = [$("select.local-usernames.spam-user").val(),
        btnUpdate.closest('.post-area-new').find('textarea.spam-msg').val().trim()];

    freechRpc("setspammsg", params,
        function(args, ret) {console.log("setspammsg updated");}, {},
        function(args, ret) {console.log("setspammsg error");}, {}
    );
}

function exitDaemon() {
    $( ".terminate-daemon").text("Exiting...");
    $( ".terminate-daemon").addClass("disabled");
    $.MAL.disableButton( $( ".terminate-daemon") );

    freechRpc("stop", undefined,
                function(args, ret) {
                    console.log("daemon exiting");

                    setTimeout(function _reload_after_exit() {
                      window.location.href = '/abort.html';
                    }, 2000);
                }, {},
                function(args, ret) {
                    console.log("error while exiting daemon");
                }, {});
}

// handlers common to both desktop and mobile
function interfaceNetworkHandlers() {
    $( ".new-peer-addr" ).keyup( peerKeypress );
    $( ".new-dns-addr" ).keyup( dnsKeypress );
    $( ".add-peer").bind( "click", addPeerClick );
    $( ".add-dns").bind( "click", addDNSClick );
    $( "select.genblock").change( setGenerate );
    $( ".genproclimit").change( setGenerate );
    $('.network .post-area-new').off('click').on('click',
        function (e) {e.stopPropagation(); $(this).addClass('open'); usePostSpliting = false;});
    $('.post-submit.update-spam-msg').off('click').on('click', setSpamMsg);
    $('.terminate-daemon').on('click',
        {txtMessage: {polyglot: 'confirm_terminate_daemon'}, cbConfirm: exitDaemon}, confirmPopup);
}


function initInterfaceNetwork() {
    initInterfaceCommon();
    initUser( function () {
        getSpamMsg();

        if( defaultScreenName ) {
            loadFollowing( function() {
                initMentionsCount();
                initDMsCount();
            });
        } else {
            $('.userMenu-profile > a').attr('href', '#/login').text(polyglot.t('Login'));
        }
    });
    networkUpdate();
    setInterval("networkUpdate()", 2000);

    miningUpdate( function() {
        $(".genproclimit").val(genproclimit);
    });
    setInterval("miningUpdate()", 2000);

    getGenerate();

    interfaceNetworkHandlers();
}
