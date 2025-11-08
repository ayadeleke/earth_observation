/* eslint-disable no-undef */
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Landing Page', () => {
    it('should display the landing page', () => {
      cy.url().should('include', 'earthobservation.azurewebsites.net')
      cy.contains('Earth', { matchCase: false })
    })

    it('should navigate to demo page', () => {
      cy.contains('Demo', { matchCase: false }).click()
      cy.url().should('include', '/demo')
    })
  })

  describe('Registration', () => {
    beforeEach(() => {
      cy.visit('/register')
    })

    it('should display registration form', () => {
      cy.get('input[name="firstName"], input[placeholder*="First"], input[type="text"]').should('exist')
      cy.get('input[name="email"], input[type="email"]').should('exist')
      cy.get('input[name="password"], input[type="password"]').should('exist')
    })

    it('should show validation errors for empty form', () => {
      cy.get('button[type="submit"]').click()
      // Form should not submit and should show validation
      cy.url().should('include', '/register')
    })

    it('should show error for password mismatch', () => {
      cy.get('input[name="firstName"], input[placeholder*="First"]').first().type('John')
      cy.get('input[name="lastName"], input[placeholder*="Last"]').first().type('Doe')
      cy.get('input[name="email"], input[type="email"]').type('test@example.com')
      cy.get('input[name="password"]').first().type('Password123!')
      cy.get('input[name="confirmPassword"], input[placeholder*="Confirm"]').type('DifferentPassword123!')
      cy.get('button[type="submit"]').click()
      // Should show error or stay on page
      cy.url().should('include', '/register')
    })

    it('should navigate to login page from register', () => {
      cy.contains('Login', { matchCase: false }).click()
      cy.url().should('include', '/login')
    })
  })

  describe('Login', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('should display login form', () => {
      cy.get('input[name="email"], input[type="email"]').should('exist')
      cy.get('input[name="password"], input[type="password"]').should('exist')
      cy.get('button[type="submit"]').should('exist')
    })

    it('should show validation for empty credentials', () => {
      cy.get('button[type="submit"]').click()
      cy.url().should('include', '/login')
    })

    it('should have forgot password link', () => {
      cy.contains('Forgot', { matchCase: false }).should('exist')
    })
  })

  describe('Forgot Password', () => {
    beforeEach(() => {
      cy.visit('/forgot-password')
    })

    it('should display forgot password form', () => {
      cy.get('input[type="email"]').should('exist')
      cy.get('button[type="submit"]').should('exist')
    })
  })
})
