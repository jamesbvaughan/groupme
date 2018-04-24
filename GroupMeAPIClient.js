require('dotenv').config()
const fetch = require('node-fetch')
const qs = require('querystring')

class GroupMeAPIClient {
  constructor(handleError) {
    this._handleError = handleError
    // this._apiURL = this._apiURL.bind(this)
  }

  _apiURL(path, params) {
    if (!params) {
      params = {}
    }
    params.access_token = process.env.GROUPME_ACCESS_TOKEN
    return `https://api.groupme.com/v3${path}?` + qs.stringify(params)
  }

  _debug(thing) {
    console.log(thing)
    process.exit(1)
  }

  _fetch(path, params) {
    return fetch(this._apiURL(path, params))
      .then(res => res.json())
      // .then(this._debug)
      .then(({ response }) => response)
      .catch(this._handleError)
  }

  getUser() {
    return this._fetch('/users/me')
  }

  getMessages(groupId) {
    return this._fetch(`/groups/${groupId}/messages`, { limit: 100 })
  }

  async getGroups() {
    const groups = await this._fetch('/groups')

    const groupsWithMessages =
      groups.map(group =>
        this.getMessages(group.id)
          .then(({ messages }) => {
            group.messages = messages
            group.messages.reverse()
            return group
          }))

    return Promise.all(groupsWithMessages)
  }

  sendMessage(groupId, text) {
    return fetch(this._apiURL(`/groups/${groupId}/messages`), {
      method: 'POST',
      body: JSON.stringify({
        message: { source_guid: Date.now(), text },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

module.exports = GroupMeAPIClient
