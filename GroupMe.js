const GroupMeAPIClient = require('./GroupMeAPIClient.js')
const GroupMeWebSocketClient = require('./GroupMeWebSocketClient.js')
const Screen = require('./Screen.js')

class GroupMe {
  _handleError(err) {
    if (this.screen) {
      this.screen.destroy()
    }
    console.error(err)
    process.exit(1)
  }

  async run() {
    const groupme = new GroupMeAPIClient(this._handleError)

    const groups = await groupme.getGroups()

    this.screen = new Screen({
      groupListWidth: 20,
      sendMessage: groupme.sendMessage.bind(groupme),
      groups,
    })

    const user = await groupme.getUser()

    const groupmeWebsockets = new GroupMeWebSocketClient({
      user,
      groups,
      screen: this.screen,
    })
  }
}

module.exports = GroupMe
