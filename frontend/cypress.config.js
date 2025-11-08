const { defineConfig } = require('cypress')

module.exports = defineConfig({
  projectId: "yqpwos",
  e2e: {
    baseUrl: 'https://earthobservation.azurewebsites.net',
    video: false,
    screenshotOnRunFailure: true,
  },
})