const blessed = require('blessed')

class Screen {
  constructor({
    sendMessage,
    groups,
    groupListWidth,
  }) {
    this.screen = blessed.screen({ smartCSR: true })
    this.screen.title = 'GroupMe'
    this.screen.enableMouse()

    this.groups = groups
    this.sendMessage = sendMessage

    this.topBar = blessed.box({
      width: '100%',
      height: 1,
      top: 0,
      style: {
        bg: 'black',
      },
      content: 'GroupMe:',
    })

    this.mainBox = blessed.box({ left: groupListWidth + 1 })
    this.content = blessed.box({ top: 1 })
    this.line = blessed.line({ left: groupListWidth })
    this.hLine = blessed.line({ orientation: 'horizontal', bottom: 1 })

    this.groupList = blessed.list({
      width: groupListWidth,
      items: this.groups.map(group => group.name),
      style: {
        selected: {
          bg: 'black',
        }
      },
      mouse: true,
    })

    this.messageList = blessed.log({
      tags: true,
      scrollable: true,
      mouse: true,
    })

    this.prompt = blessed.box({
      height: 1,
      bottom: 0,
      content: '[James Vaughan]',
    })

    this.inputBar = blessed.textbox({
      height: 1,
      bottom: 0,
      left: this.prompt.content.length + 1,
      inputOnFocus: true,
      keys: true,
    })

    this._append(this.screen, [
      this.topBar,
      this.content,
    ])

    this._append(this.content, [
      this.groupList,
      this.line,
      this.mainBox,
    ])

    this._append(this.mainBox, [
      this.messageList,
      this.hLine,
      this.prompt,
      this.inputBar,
    ])

    this.screen.render()

    this._setupKeybindings()

    this._setupEventListeners()

    this.groupList.select(1)
    this.selectGroup(this.groups[0])

    this.inputBar.focus()
  }

  _formatMessage(message) {
    if (message.name === 'GroupMe') {
      return `{green-fg}${message.text}{/green-fg}`
    }
    return `{bold}${message.name}:{/bold} ${message.text}`
  }

  selectGroup(group) {
    this.messageList.setContent('')
    this.topBar.setContent(`GroupMe: ${group.name}`)

    this.currentGroup = group

    group.messages.forEach(message => {
      if (message.text) {
        this.messageList.add(this._formatMessage(message))
      }
    })

    this.screen.render()
  }

  addMessage(message) {
    this.messageList.add(message)
    this.screen.render()
  }

  _append(parent, children) {
    children.forEach(child => {
      parent.append(child)
    })
  }

  _setupKeybindings() {
    this.screen.key(['escape', 'q', 'C-c'], (ch, key) => process.exit(0))
    this.screen.key('C-n', () => this.groupList.down())
    this.screen.key('C-p', () => this.groupList.up())
    this.inputBar.key('C-n', () => this.groupList.down())
    this.inputBar.key('C-p', () => this.groupList.up())
  }

  _setupEventListeners() {
    this.groupList.on('select item', list => {
      const group = this.groups.find(g => g.name === list.content)
      if (group) {
        this.selectGroup(group)
      }
    })

    this.inputBar.on('submit', () => {
      const text = this.inputBar.getValue()
      switch (text) {
        case '/q':
        case '/quit':
          process.exit(0)
          break
        default:
          this.sendMessage(this.currentGroup.id, text)
            .then(() => {
              this.inputBar.clearValue()
              this.inputBar.focus()
            })
      }
    })
  }
}

module.exports = Screen
