chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Installed')
})

async function authenticateUser() {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: `https://accounts.google.com/o/oauth2/auth?client_id=YOUR_GOOGLE_CLIENT_ID&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile openid`,
        interactive: true,
      },
      function (responseUrl) {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(chrome.runtime.lastError)
          return
        }

        const accessToken = new URL(responseUrl).hash
          .split('&')[0]
          .split('=')[1]
        resolve(accessToken)
      }
    )
  })
}

async function getUserInfo(token) {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  return await response.json()
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    authenticateUser()
      .then((token) => {
        getUserInfo(token).then((user) => {
          sendResponse({ success: true, user, token })
        })
      })
      .catch((error) => sendResponse({ success: false, error }))
    return true
  }
})
