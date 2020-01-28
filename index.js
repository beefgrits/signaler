const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 0 }) // Change 0 to custom port number you plan to use for the signaling server URL
const https = require('https')

const authorized = ['012345678901234567890','123456789012345678901'] // change to actual google account id values of your desired authorized users

function noop() {}

function heartbeat() {
    this.isAlive = true
}

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false)  return ws.terminate()
        ws.isAlive = false
        ws.ping(noop)
    })
}, 30000)

const sendTo = (ws, message) => {
    ws.send(JSON.stringify(message))
}

const broadcast = (message) => {
    wss.clients.forEach(function(client) {
        if (authorized.includes(client.userinfo.id) && client.userinfo.email !== message.email) {
            sendTo(client, message)
        }
    })
}

const getRecipient = (email, callback) => {
        wss.clients.forEach(function(client) {
        if (client.userinfo.email == email) {
            callback(client)
            return
        }
        return
    })
}

const getUserInfo = (token, callback) => {
    https.get({
        host: 'www.googleapis.com',
        port: 443,
        path: '/oauth2/v2/userinfo',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    }, res => {
        var body = ''
	console.log('Google API response code:', res.statusCode)
        console.log('Google API status message:', res.statusMessage)
        res.on('data', d => {
            body += d
        })
        res.on('end', () => {
        let data
        try {
            data = JSON.parse(body)
        } catch (error) {
            console.error('Invalid JSON', error)
            data = {}
        }
        callback(data)
    })
}).on('error', e => {
        console.error(e)
    })
}

function getUserList(user, callback) {
    var userList = {users: []}
    wss.clients.forEach(function(client) {
        if (typeof client.userinfo !== 'undefined' && client !== user) {
            userList.users.push({email: client.userinfo.email, name: client.userinfo.name})
        }
    })
    callback(userList)
}

wss.on('connection', ws => {
    console.log('New Connection')
    ws.isAlive = true
    ws.on('pong', heartbeat)
    ws.on('close', () => {
	if (typeof ws.userinfo !== 'undefined') {
	    console.log(ws.userinfo.name + " is no longer connected.")
            broadcast({action: 'disconnected', user: ws.userinfo.email})
	}
    })
    ws.on('message', message => {
        let data
        try {
            data = JSON.parse(message)
        } catch (error) {
            console.error('Invalid JSON', error)
            data = {}
        }
        if (typeof ws.userinfo !== 'undefined') {
            switch (data.action) {
                case 'offer':
                    getRecipient(data.user, (client) => {
                    	console.log(ws.userinfo.name + ' is sending an offer to ' + data.user)
                    	sendTo(client, {action: 'offer', user: ws.userinfo.email, offer: data.offer})
                    })
                    break
                case 'answer':
                    getRecipient(data.user, (client) => {
                        console.log(ws.userinfo.name + ' is sending an answer to ' + data.user)
                        sendTo(client, {action: 'answer', user: ws.userinfo.email, answer: data.answer})
                    })
                    break
                case 'candidate':
                    getRecipient(data.user, (client) => {
                      console.log(ws.userinfo.name + ' is sending candidate to ' + data.user)
                      sendTo(client, {action: 'candidate', user: ws.userinfo.email, candidate: data.candidate})
                    })
                    break
                case 'leave':
                    console.log(ws.user + ' is disconnected')
                    broadcast({action: 'disconnected', user: ws.userinfo.email})
                    ws.close()
                    break
                default:
                    sendTo(ws, {action: 'unknown', message: data})
                    console.log(ws.userinfo.name + ' sent unhandled command ' + JSON.stringify(data))
                    break
            }
        }
        else {
            switch (data.action) {
                case 'id':
                    getUserInfo(data.token, userinfo => {
                        if (authorized.includes(userinfo.id)) {
                            console.log(userinfo.name + " is online.")
                            ws.userinfo = userinfo
                            getUserList(ws, userlist => {
                                sendTo(ws, {action: 'identified', user: userinfo.name, userList: userlist})
                                broadcast({action: 'connected', name: userinfo.name, email: userinfo.email})
			    })
                        }
			else {
                            console.log(userinfo.name + " is not authorized to use this system. " + userinfo.id)
                            sendTo(ws, {action: 'unauthorized'})
                            ws.terminate()
                        }
                    })
                    break
                default:
                    console.log("unauthorized use.")
                    sendTo(ws, {action: 'unauthorized'})
                    ws.terminate()
                    break
            }
        }
	})
})
