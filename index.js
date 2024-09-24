import Gun from 'gun/gun'
import 'gun/sea'
import 'gun/lib/radix'
import 'gun/lib/radisk'
import 'gun/lib/store'
import 'gun/lib/rindexed'
import {Client} from 'relaytorelay'

function GunProxy(opts) {
    const debug = opts.debug
    let urlProxy

    const channel = new Client(opts.url, opts.hash, opts.rtr || {})

    setInterval(() => {channel.db.clear({gt: 'gun-'}).then(console.log).catch(console.error)}, 300000)

    const connect = (chan) => {console.log('connected: ' + chan)}
    const err = (e) => {console.error(e)}
    const disconnect = (chan) => {console.log('disconnected: ' + chan)}
    channel.on('connect', connect)
    channel.on('error', err)
    channel.on('disconnect', disconnect)

    // WebSocketProxy definition

    const WebSocketProxy = function (url) {
        const websocketproxy = {};

        websocketproxy.url = url || 'ws:proxy';
        urlProxy = url || 'ws:proxy';
        websocketproxy.CONNECTING = 0;
        websocketproxy.OPEN = 1;
        websocketproxy.CLOSING = 2;
        websocketproxy.CLOSED = 3;
        websocketproxy.readyState = 1;
        websocketproxy.bufferedAmount = 0;
        websocketproxy.onopen = function () { };
        websocketproxy.onerror = function () { };
        websocketproxy.onclose = function () { };
        websocketproxy.extensions = '';
        websocketproxy.protocol = '';
        websocketproxy.close = { code: '4', reason: 'Closed' };
        websocketproxy.onmessage = function () { }; //overwritten by gun
        websocketproxy.binaryType = 'blob';
        websocketproxy.send = sendMessage;

        return websocketproxy
    }

    let gunMessage

    function attachGun(gun){
        // setTimeout(() => {
        //     if(urlProxy){
        //         if(debug){
        //             console.log('proxy', urlProxy)
        //         }
        //         gunMessage = gun._.opt.peers[urlProxy].wire.onmessage
        //         channel.on('data', onMessage)
        //         gun.shutdown = shutdown(gun)
        //         gun.status = true
        //         console.log('gundb is attached')
        //     } else {
        //         setTimeout(() => {attachGun(gun)}, 5000)
        //     }
        // }, 5000)
        if(debug){
            console.log('proxy', urlProxy)
        }
        gunMessage = gun._.opt.peers[urlProxy].wire.onmessage
        channel.on('message', onMessage)
        gun.shutdown = shutdown(gun)
        gun.status = true
        console.log('gundb is attached')
    }

    function sendMessage(data){
        if(debug){
            console.log('Sending Data: ', typeof(data), data)
        }
        channel.onSend(data)
    }

    async function onMessage(data){
        if(debug){
            console.log('Received Message: ', typeof(data), data)
        }
        const test = await msg(data)
        const testing = await channel.dbGet('gun-' + test)
        if(!testing){
            await channel.dbPost('gun-' + test, data)
            gunMessage(data)
        }
    }

    function shutdown(gun){
        return function(){
            channel.off('connect', connect)
            channel.off('message', onMessage)
            channel.off('error', err)
            channel.off('disconnect', disconnect)
            var mesh = gun.back('opt.mesh'); // DAM
            var peers = gun.back('opt.peers');
            Object.keys(peers).forEach((id) => {mesh.bye(id)});
            gun.status = false
            channel.quit()
        }
    }

    async function msg(message) {
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(message)))).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    return {WebSocketProxy, attachGun}
};

export default function(config){
    // instantiate module
    const {WebSocketProxy, attachGun} = GunProxy(config)
    // configure websocket
    // const proxyWebSocket = WebSocketProxy(config)
    // pass websocket as custom websocket to gun instance
    // make sure localStorage / indexedDB is on
    const gun = Gun({ ...(config.gun || {}), localStorage: false, radisk: true, peers: ["proxy:websocket"], WebSocket: WebSocketProxy })
    setTimeout(() => {attachGun(gun)}, 5000)
    return gun
}