require('dotenv').config()
const fetch = require('node-fetch')
const WebSocket = require('ws')
const blessed = require('blessed')
const libnotify = require('libnotify')

let currentGroup = ''

const formatMessage = message => {
  if (message.name === 'GroupMe') {
    return `{green-fg}${message.text}{/green-fg}`
  }
  return `{bold}${message.name}:{/bold} ${message.text}`
}

async function main() {
  const screen = blessed.screen({
    smartCSR: true,
  })

  screen.enableMouse()

  const handleError = err => {
    screen.destroy()
    console.error(err)
    process.exit(1)
  }

  const apiURL = path =>
    `https://api.groupme.com/v3${path}?access_token=${process.env.GROUPME_ACCESS_TOKEN}`

  const fetchJSON = path =>
    fetch(apiURL(path))
      .then(r => r.json())
      .then(({ response }) => response)
      .catch(handleError)

  const getUser = () => fetchJSON('/users/me')

  const getGroups = () => fetchJSON('/groups')

  const getMessages = (groupId) => fetchJSON(`/groups/${groupId}/messages`)

  const sendMessage = (groupId, message) =>
    fetch(apiURL(`/groups/${groupId}/messages`), {
      method: 'POST',
      body: JSON.stringify({
        message: {
          source_guid: Date.now(),
          text: message,
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json())
      .catch(handleError)

  screen.title = 'test title'

  // UI Elements ==============================================================
  const groupListWidth = 20

  const topBar = blessed.box({
    width: '100%',
    height: 1,
    top: 0,
    style: {
      bg: 'black',
    },
    content: 'GroupMe:',
  })

  const content = blessed.box({
    top: 1,
  })

  const groupList = blessed.list({
    width: groupListWidth,
    items: ['loading groups...'],
    style: {
      selected: {
        // fg: 'black',
        bg: 'black',
      }
    },
    mouse: true,
  })

  const line = blessed.line({
    left: groupListWidth,
  })

  const messageList = blessed.log({
    tags: true,
    scrollable: true,
    mouse: true,
  })

  const hLine = blessed.line({
    orientation: 'horizontal',
    bottom: 1,
  })

  const prompt = blessed.box({
    height: 1,
    bottom: 0,
    content: '[James Vaughan]',
  })

  const inputBar = blessed.textbox({
    height: 1,
    bottom: 0,
    left: prompt.content.length + 1,
    inputOnFocus: true,
    keys: true,
  })

  const mainBox = blessed.box({
    left: groupListWidth + 1,
  })

  content.append(groupList)
  content.append(line)
  content.append(mainBox)
  mainBox.append(messageList)
  mainBox.append(prompt)
  mainBox.append(hLine)
  mainBox.append(inputBar)
  screen.append(topBar)
  screen.append(content)


  // Keybindings ==============================================================
  screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0))
  screen.key('C-n', () => groupList.down())
  screen.key('C-p', () => groupList.up())
  inputBar.key('C-n', () => groupList.down())
  inputBar.key('C-p', () => groupList.up())


  groupList.select(1)

  screen.render()

  inputBar.focus()

  const groups = await getGroups()

  const updateSelectedGroup = groupName => {
    currentGroup = groups.find(g => g.name === groupName)
    messageList.setContent('loading messages...')
    getMessages(currentGroup.id)
      .then(({ messages })=> {
        messageList.setContent('')
        messageTexts =
          messages
            .reverse()
            .forEach(message => message.text && messageList.add(formatMessage(message)))
        topBar.setContent(`GroupMe: ${groupName}`)
        screen.render()
        inputBar.focus()
      })
      .catch(handleError)
  }

  groupList.on('select item', list => updateSelectedGroup(list.content))

  inputBar.on('submit', () => {
    const text = inputBar.getValue()
    switch (text) {
      case '/q':
      case '/quit':
        process.exit(0)
        break
      default:
        sendMessage(currentGroup.id, text)
          .then(res => {
            inputBar.clearValue()
            inputBar.focus()
          })
    }
  })

  groupList.setItems(groups.map(({ name }) => name))
  updateSelectedGroup(groupList.ritems[0])

  screen.render()

  const ws = new WebSocket('wss://push.groupme.com/faye')

  const user = await getUser()

  ws.on('open', () => {
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
        break;
      case `/user/${user.id}`:
        if (data.data.type === 'line.create') {
          const message = data.data.subject
          if (message.group_id === currentGroup.id) {
            messageList.add(formatMessage(message))
          }
          if (message.user_id !== user.id) {
            const group = groups.find(g => g.id === message.group_id)
            libnotify.notify(`${message.name}: ${message.text}`, {
              title: `GroupMe: ${group.name}`,
            })
          }
        }
        break
      default:
        messageList.add(`${data.channel}`)
        break
    }
  })

}

main()
