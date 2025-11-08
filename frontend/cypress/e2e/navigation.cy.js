/* eslint-disable no-undef */
describe('Navigation and Routing', () => {
  describe('Public Routes', () => {
    it('should access demo page without authentication', () => {
      cy.visit('/demo')
      cy.url().should('include', '/demo')
      cy.contains('Demo', { matchCase: false })
    })

    it('should access about page', () => {
      cy.visit('/about')
      cy.url().should('include', '/about')
    })

    it('should access privacy policy page', () => {
      cy.visit('/privacy')
      cy.url().should('include', '/privacy')
      cy.contains('Privacy', { matchCase: false })
    })
  })

  describe('Protected Routes', () => {
    it('should redirect to login when accessing dashboard without auth', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/login')
    })

    it('should redirect to login when accessing analysis without auth', () => {
      cy.visit('/analysis')
      cy.url().should('include', '/login')
    })

    it('should redirect to login when accessing projects without auth', () => {
      cy.visit('/projects')
      cy.url().should('include', '/login')
    })

    it('should redirect to login when accessing settings without auth', () => {
      cy.visit('/settings')
      cy.url().should('include', '/login')
    })
  })

  describe('Header Navigation', () => {
    beforeEach(() => {
      cy.visit('/')
    })

    it('should navigate to home from logo/brand', () => {
      cy.visit('/demo')
      cy.get('a[href="/"], nav a').first().click()
      cy.url().should('eq', Cypress.config().baseUrl + '/')
    })

    it('should have working navigation links in header', () => {
      cy.visit('/demo')
      // Check that navigation exists
      cy.get('nav, header').should('exist')
    })
  })

  describe('Footer Navigation', () => {
    beforeEach(() => {
      cy.visit('/about')
    })

    it('should display footer', () => {
      cy.get('footer').should('exist')
    })

    it('should have privacy policy link in footer', () => {
      cy.get('footer').contains('Privacy', { matchCase: false }).should('exist')
    })
  })
})
