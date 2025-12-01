// module.exports = {
//   projectId: "yqpwos",
//   // ...rest of the Cypress project config
// }
const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://earthobservation.azurewebsites.net',
  },
})