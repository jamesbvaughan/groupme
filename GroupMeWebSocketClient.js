const WebSocket = require('ws')
const libnotify = require('libnotify')

class GroupMeWebSocketClient {
  constructor({
    user,
    groups,
    screen,
  }) {
    const ws = new WebSocket('wss://push.groupme.com/faye')

    libnotify.notify('Websocket opening', { title: `GroupMe` })

    ws.on('open', () => {
      libnotify.notify('Websocket opened', { title: `GroupMe` })
      ws.send(JSON.stringify({
        channel: '/meta/handshake',
        version: '1.0',
        supportedConnectionTypes: ['websocket'],
        id: '1',
      }))
    })

    ws.on('message', message => {
      const [data] = JSON.parse(message)

      switch (data.channel) {
        case '/meta/handshake':
          libnotify.notify(JSON.stringify(data), { title: `GroupMe: ${data.channel}` })
          ws.send(JSON.stringify({
            channel: '/meta/subscribe',
            clientId: data.clientId,
            subscription: `/user/${user.id}`,
            id: '2',
            ext: {
              access_token: process.env.GROUPME_ACCESS_TOKEN,
              timestamp: Date.now(),
            },
          }))
          break
        case '/meta/subscribe':
          libnotify.notify('Sockets listening', { title: 'GroupMe' })
          break;
        case `/user/${user.id}`:
          if (data.data.type === 'line.create') {
            const message = data.data.subject
            if (message.group_id === screen.currentGroup.id) {
              screen.addMessage(screen._formatMessage(message))
            }
            const group = groups.find(g => g.id === message.group_id)
            group.messages.push(message)
            if (message.user_id !== user.id) {
              libnotify.notify(`${message.name}: ${message.text}`, {
                title: `GroupMe: ${group.name}`,
              })
            }
          }
          break
        default:
          libnotify.notify(JSON.stringify(data), { title: `GroupMe: ${data.channel}` })
          break
      }
    })
  }
}

module.exports = GroupMeWebSocketClient
