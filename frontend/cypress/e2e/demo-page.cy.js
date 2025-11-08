/* eslint-disable no-undef */
describe('Demo Page Integration', () => {
  beforeEach(() => {
    cy.visit('/demo')
  })

  it('should load demo page successfully', () => {
    cy.url().should('include', '/demo')
    cy.contains('Demo', { matchCase: false })
  })

  it('should display demo form with required fields', () => {
    // Should have date inputs or year selectors
    cy.get('input[type="number"], input[type="date"], select').should('exist')
  })

  it('should have a map component', () => {
    // Leaflet map container
    cy.get('.leaflet-container, #map, [class*="map"]', { timeout: 10000 }).should('exist')
  })

  it('should display demo notice/warning', () => {
    cy.contains('demo', { matchCase: false })
  })

  it('should have navigation buttons', () => {
    cy.contains('Home', { matchCase: false }).should('exist')
  })

  it('should navigate back to home', () => {
    cy.contains('Home', { matchCase: false }).click()
    cy.url().should('eq', Cypress.config().baseUrl + '/')
  })

  it('should have upgrade/get access button', () => {
    cy.contains(/upgrade|access|register|dashboard/i).should('exist')
  })

  it('should allow drawing on map', () => {
    // Check for Leaflet draw controls
    cy.get('.leaflet-draw-toolbar, .leaflet-draw', { timeout: 5000 }).should('exist')
  })

  it('should have analysis type selector', () => {
    cy.get('select, [role="listbox"], input[type="radio"]').should('exist')
  })

  it('should have submit/analyze button', () => {
    cy.get('button').contains(/analyze|submit|run|start/i).should('exist')
  })

  it('should display demo results after analysis', () => {
    // Fill in minimal form data and submit
    cy.get('button').contains(/analyze|submit|run|start/i).first().click()
    
    // Wait for results (demo should show mock results quickly)
    cy.get('[class*="result"], .card-body, .chart', { timeout: 10000 }).should('exist')
  })

  it('should display charts in demo results', () => {
    cy.get('button').contains(/analyze|submit|run|start/i).first().click()
    
    // Check for chart elements (recharts)
    cy.get('.recharts-wrapper, svg, canvas', { timeout: 10000 }).should('exist')
  })

  it('should have download option for demo data', () => {
    cy.get('button').contains(/analyze|submit|run|start/i).first().click()
    
    // Check for download button
    cy.get('button').contains(/download|export|csv/i, { timeout: 10000 }).should('exist')
  })
})
