/* eslint-disable no-undef */
describe('Earth Observation App', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should load the homepage successfully', () => {
    cy.url().should('include', 'earthobservation.azurewebsites.net')
  })

  it('should have a visible navigation or header', () => {
    // Adjust selectors based on your actual app structure
    cy.get('nav, header').should('be.visible')
  })

  it('should display the main content area', () => {
    // Adjust selector based on your actual app structure
    cy.get('main, #root, .App').should('exist')
  })

  it('should not have any console errors', () => {
    cy.window().then((win) => {
      cy.spy(win.console, 'error')
    })
  })
})
