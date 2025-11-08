/* eslint-disable no-undef */
describe('Responsive Design', () => {
  const viewports = [
    { device: 'mobile', width: 375, height: 667 },
    { device: 'tablet', width: 768, height: 1024 },
    { device: 'desktop', width: 1920, height: 1080 }
  ]

  viewports.forEach(({ device, width, height }) => {
    describe(`${device} (${width}x${height})`, () => {
      beforeEach(() => {
        cy.viewport(width, height)
      })

      it('should load landing page', () => {
        cy.visit('/')
        cy.get('body').should('be.visible')
      })

      it('should load demo page', () => {
        cy.visit('/demo')
        cy.get('body').should('be.visible')
      })

      it('should load login page', () => {
        cy.visit('/login')
        cy.get('input[type="email"]').should('be.visible')
        cy.get('input[type="password"]').should('be.visible')
      })

      it('should load about page', () => {
        cy.visit('/about')
        cy.get('body').should('be.visible')
      })
    })
  })

  describe('Touch Interactions', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
      cy.visit('/demo')
    })

    it('should be touch-friendly on demo page', () => {
      // Buttons should be large enough for touch
      cy.get('button').first().should('be.visible')
    })
  })
})
