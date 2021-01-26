require('dotenv').config()
const tmi = require('tmi.js')
const axios = require('axios')
const qs = require('querystring')
const orbit = require('./orbit.js')

const channel = process.env.TWITCH_CHANNEL
let client, stream, nextCheckLiveStatus = new Date()

module.exports = {
    init: async () => {
        try {
            await checkTwitchStatus()
            await initClient()
            client.on('message', onMessage)
        } catch(error) {
            reject(error)
        }
    }
}

const checkTwitchStatus = () => {
    console.log('⚡ twitch:checkTwitchStatus')
    return new Promise(async (resolve, reject) => {
        const opts = {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
            scopes: '',
        }

        const { data } = await axios.post(`https://id.twitch.tv/oauth2/token?${qs.stringify(opts)}`)
        const { data: { data: streams } } = await axios({
            method: 'GET',
            url: `https://api.twitch.tv/helix/streams?user_login=${process.env.TWITCH_CHANNEL}`,
            headers: {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                Authorization: `Bearer ${data.access_token}`,
            }
        })

        const dt = new Date()
        if(streams.length > 0) {
            const { id, title } = streams[0]
            nextCheckLiveStatus = dt.setSeconds(dt.getSeconds() + 60)
            stream = { id, title }
            resolve({ id, title })
        } else {
            nextCheckLiveStatus = dt.setSeconds(dt.getSeconds() + 60)
            resolve(false)
        }
    })
}

const initClient = () => {
    console.log('⚡ twitch:initClient')
    return new Promise((resolve, reject) => {
        client = new tmi.client({
            identity: {
                username: process.env.TWITCH_USER,
                password: process.env.TWITCH_USER_TOKEN
            },
            channels: [ channel ],
            connection: { reconnect: true }
        })

        client.connect()
        resolve()
    })
}

const onMessage = async (channel, tags, message, self) => {
    console.log('⚡ twitch:onMessage')


    if(new Date() > nextCheckLiveStatus) {
        await checkTwitchStatus()
    }

    if(self || tags.mod) return

    await orbit.addActivity({
        activity: {
            title: 'Participated in Twitch Chat',
            description: stream.title,
            activity_type: 'twitch:chat',
            key: `${stream.id}-${tags.username}`
        },
        identity: {
            source: 'Twitch',
            source_host: `https://twitch.tv/${channel}`,
            username: tags.username
        }
    })
}