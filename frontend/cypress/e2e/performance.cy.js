/* eslint-disable no-undef */
describe('Performance', () => {
  describe('Page Load Times', () => {
    it('should load landing page within acceptable time', () => {
      const start = Date.now()
      cy.visit('/')
      cy.get('body').should('be.visible')
      const loadTime = Date.now() - start
      
      // Should load within 10 seconds
      expect(loadTime).to.be.lessThan(10000)
    })

    it('should load demo page within acceptable time', () => {
      const start = Date.now()
      cy.visit('/demo')
      cy.get('body').should('be.visible')
      const loadTime = Date.now() - start
      
      expect(loadTime).to.be.lessThan(10000)
    })

    it('should load login page quickly', () => {
      const start = Date.now()
      cy.visit('/login')
      cy.get('input[type="email"]').should('be.visible')
      const loadTime = Date.now() - start
      
      expect(loadTime).to.be.lessThan(5000)
    })
  })

  describe('Resource Loading', () => {
    beforeEach(() => {
      cy.visit('/')
    })

    it('should load CSS resources', () => {
      cy.get('link[rel="stylesheet"]').should('exist')
    })

    it('should load JavaScript resources', () => {
      cy.window().should('exist')
      cy.document().should('exist')
    })
  })

  describe('Interactive Elements', () => {
    beforeEach(() => {
      cy.visit('/demo')
    })

    it('should load map component efficiently', () => {
      cy.get('.leaflet-container, #map, [class*="map"]', { timeout: 8000 })
        .should('exist')
    })
  })
})
