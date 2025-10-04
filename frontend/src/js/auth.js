/**
 * Earth Engine Authentication Handler
 * Handles authentication guidance for Google Earth Engine
 */

class EEAuthHandler {
    constructor() {
        // Simplified auth handler for command-line authentication
    }

    /**
     * Check current authentication status
     */
    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/ee/check');
            const data = await response.json();
            return data.authenticated;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return false;
        }
    }

    /**
     * Get detailed authentication status
     */
    async getAuthStatus() {
        try {
            const response = await fetch('/auth/ee/status');
            return await response.json();
        } catch (error) {
            console.error('Error getting auth status:', error);
            return { authenticated: false, error: error.message };
        }
    }

    /**
     * Handle authentication response from server
     */
    handleAuthResponse(response) {
        if (response.auth_required && response.instructions) {
            // Show authentication instructions modal
            this.showAuthInstructionsModal(response.instructions);
            return true;
        }
        return false;
    }

    /**
     * Show authentication instructions modal
     */
    showAuthInstructionsModal(instructions) {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="authModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-key me-2"></i>
                                ${instructions.title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>Authentication Required:</strong> Earth Engine needs to be authenticated before you can access satellite data.
                            </div>
                            
                            <h6><i class="fas fa-terminal me-2"></i>Quick Setup Instructions:</h6>
                            <ol class="list-group list-group-numbered mb-4">
                                ${instructions.steps.map(step => `
                                    <li class="list-group-item">${step}</li>
                                `).join('')}
                            </ol>
                            
                            <div class="p-3 bg-light rounded">
                                <h6><i class="fas fa-code me-2"></i>Command to run:</h6>
                                <div class="bg-dark text-light p-2 rounded">
                                    <code style="color: #00ff00;">earthengine authenticate</code>
                                </div>
                                <small class="text-muted mt-2 d-block">
                                    Copy and paste this command into your terminal/command prompt
                                </small>
                            </div>
                            
                            <div class="mt-4">
                                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                        I'll do this later
                                    </button>
                                    <button type="button" class="btn btn-primary" onclick="eeAuth.checkAndRetry()">
                                        <i class="fas fa-refresh me-2"></i>
                                        I've authenticated - Try again
                                    </button>
                                </div>
                            </div>
                            
                            <div class="mt-4 p-3 bg-light rounded">
                                <h6><i class="fas fa-question-circle me-2"></i>Need the Earth Engine CLI?</h6>
                                <p class="mb-2">If you don't have the Earth Engine command-line tool installed:</p>
                                <a href="${instructions.alternative}" target="_blank" class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-external-link-alt me-1"></i>
                                    Installation Guide
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('authModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('authModal'));
        modal.show();
    }

    /**
     * Check authentication and retry the last request
     */
    async checkAndRetry() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('authModal'));
        
        // Show loading state
        const modalBody = document.querySelector('#authModal .modal-body');
        const originalContent = modalBody.innerHTML;
        
        modalBody.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h6>Checking authentication status...</h6>
                <p class="text-muted">Please wait while we verify your Earth Engine authentication</p>
            </div>
        `;

        try {
            // Check if authentication is now working
            const isAuthenticated = await this.checkAuthStatus();
            
            if (isAuthenticated) {
                // Success - close modal and retry
                modal.hide();
                this.showSuccessMessage();
                
                // Trigger a retry of the original form submission
                if (window.retryLastRequest) {
                    setTimeout(() => {
                        window.retryLastRequest();
                    }, 1000);
                }
            } else {
                // Still not authenticated
                modalBody.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Still not authenticated.</strong> Please make sure you've run the earthengine authenticate command and completed the authentication flow.
                    </div>
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-outline-primary" onclick="eeAuth.checkAndRetry()">
                            <i class="fas fa-refresh me-2"></i>
                            Try Again
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="document.querySelector('#authModal .modal-body').innerHTML = \`${originalContent.replace(/`/g, '\\`')}\`">
                            <i class="fas fa-arrow-left me-2"></i>
                            Back to Instructions
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            modalBody.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error checking authentication: ${error.message}
                </div>
                <div class="d-grid">
                    <button type="button" class="btn btn-primary" onclick="eeAuth.checkAndRetry()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show success message
     */
    showSuccessMessage() {
        // Create success toast
        const toastHtml = `
            <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;">
                <div class="toast align-items-center text-white bg-success border-0" role="alert">
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="fas fa-check-circle me-2"></i>
                            Successfully authenticated with Earth Engine!
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', toastHtml);
        const toast = new bootstrap.Toast(document.querySelector('.toast'));
        toast.show();

        // Remove toast after it's hidden
        setTimeout(() => {
            const toastContainer = document.querySelector('.toast-container');
            if (toastContainer) {
                toastContainer.remove();
            }
        }, 5000);
    }

    /**
     * Clear authentication
     */
    async clearAuth() {
        try {
            const response = await fetch('/auth/ee/clear');
            const data = await response.json();
            if (data.success) {
                console.log('Authentication cleared successfully');
                return true;
            } else {
                throw new Error(data.error || 'Clear auth failed');
            }
        } catch (error) {
            console.error('Error clearing auth:', error);
            return false;
        }
    }
}

// Global instance
const eeAuth = new EEAuthHandler();

// Make it available globally
window.eeAuth = eeAuth;
