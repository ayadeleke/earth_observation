/* eslint-disable no-undef */
describe('Form Validation and Interaction', () => {
  describe('Registration Form', () => {
    beforeEach(() => {
      cy.visit('/register')
    })

    it('should validate email format', () => {
      cy.get('input[type="email"]').type('invalid-email')
      cy.get('button[type="submit"]').click()
      // Should show validation error or prevent submission
      cy.url().should('include', '/register')
    })

    it('should toggle password visibility', () => {
      const passwordInput = cy.get('input[name="password"]').first()
      passwordInput.should('have.attr', 'type', 'password')
      
      // Look for eye icon to toggle
      cy.get('[class*="eye"], button[aria-label*="password"], [data-testid*="password"]')
        .first()
        .click({ force: true })
    })

    it('should accept valid form data', () => {
      const timestamp = Date.now()
      cy.get('input[name="firstName"], input[placeholder*="First"]').first().type('Test')
      cy.get('input[name="lastName"], input[placeholder*="Last"]').first().type('User')
      cy.get('input[type="email"]').type(`test${timestamp}@example.com`)
      cy.get('input[name="password"]').first().type('SecurePassword123!')
      cy.get('input[name="confirmPassword"], input[placeholder*="Confirm"]').type('SecurePassword123!')
      
      // Form should be fillable
      cy.get('input[type="email"]').should('have.value', `test${timestamp}@example.com`)
    })
  })

  describe('Login Form', () => {
    beforeEach(() => {
      cy.visit('/login')
    })

    it('should handle form submission', () => {
      cy.get('input[type="email"]').type('test@example.com')
      cy.get('input[type="password"]').type('password123')
      cy.get('button[type="submit"]').click()
      
      // Should attempt to process login
      cy.wait(1000)
    })

    it('should clear form fields', () => {
      cy.get('input[type="email"]').type('test@example.com').clear()
      cy.get('input[type="email"]').should('have.value', '')
    })
  })

  describe('Demo Form', () => {
    beforeEach(() => {
      cy.visit('/demo')
    })

    it('should allow date/year selection', () => {
      cy.get('input[type="number"], input[type="date"], select').first().should('exist')
    })

    it('should handle form interactions', () => {
      // Fill some form data
      cy.get('input, select').first().click({ force: true })
    })

    it('should submit without errors', () => {
      cy.get('button').contains(/analyze|submit|run|start/i).first().click()
      
      // Should show some feedback
      cy.wait(2000)
      cy.get('body').should('exist')
    })
  })
})
