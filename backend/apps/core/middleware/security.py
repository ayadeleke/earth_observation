"""
Security Middleware for Earth Observation Platform

Adds comprehensive security headers to all HTTP responses to protect against:
- XSS attacks
- Clickjacking
- MIME sniffing
- Protocol downgrade attacks
- Content injection

Addresses OWASP ZAP security scan findings.
"""

from django.conf import settings


class SecurityHeadersMiddleware:
    """
    Add security headers to all responses.
    
    Headers added:
    - Content-Security-Policy: Prevents XSS and content injection
    - X-Frame-Options: Prevents clickjacking
    - X-Content-Type-Options: Prevents MIME sniffing
    - Strict-Transport-Security: Enforces HTTPS
    - Referrer-Policy: Controls referrer information
    - Permissions-Policy: Controls browser features
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        response = self.get_response(request)
        
        # Only add headers if not already present (allow override)
        if 'Content-Security-Policy' not in response:
            # Comprehensive CSP policy
            # Allows connections to:
            # - Self (same origin)
            # - Google APIs (Earth Engine, OAuth, Fonts, etc.)
            # - Azure services (storage, APIs)
            # - CDN services (Bootstrap, FontAwesome, etc.)
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
                "img-src 'self' data: https: blob:",
                "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
                "connect-src 'self' https://earthobservationapi.azurewebsites.net https://accounts.google.com https://www.googleapis.com https://earthengine.googleapis.com https://cdn.jsdelivr.net https://*.blob.core.windows.net",
                "frame-src 'self' https://accounts.google.com https://earthobservationapi.azurewebsites.net https://*.blob.core.windows.net",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self' https://accounts.google.com",
                "frame-ancestors 'self' https://earthobservation.azurewebsites.net",
                "upgrade-insecure-requests",
            ]
            response['Content-Security-Policy'] = '; '.join(csp_directives)
        
        if 'X-Frame-Options' not in response:
            # Allow framing from same origin and trusted domains
            # SAMEORIGIN allows embedding in same-origin iframes (for maps, visualizations)
            response['X-Frame-Options'] = 'SAMEORIGIN'
        
        if 'X-Content-Type-Options' not in response:
            # Prevent MIME type sniffing
            response['X-Content-Type-Options'] = 'nosniff'
        
        if 'Strict-Transport-Security' not in response:
            # Enforce HTTPS for 1 year, include subdomains
            # Only add in production (when HTTPS is available)
            if not settings.DEBUG:
                response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        if 'Referrer-Policy' not in response:
            # Control referrer information
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        if 'Permissions-Policy' not in response:
            # Control browser features
            # Allow geolocation (for map features), deny other sensitive features
            response['Permissions-Policy'] = 'geolocation=(self), microphone=(), camera=(), payment=(), usb=()'
        
        return response


class SecureCookieMiddleware:
    """
    Ensure all cookies have proper security attributes.
    
    Attributes:
    - Secure: Only sent over HTTPS
    - HttpOnly: Not accessible via JavaScript
    - SameSite: Protection against CSRF
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        response = self.get_response(request)
        
        # Apply to all Set-Cookie headers
        if hasattr(response, 'cookies'):
            for cookie in response.cookies.values():
                # Only set Secure flag in production (requires HTTPS)
                if not settings.DEBUG:
                    cookie['secure'] = True
                
                # HttpOnly prevents JavaScript access (already default for session cookies)
                cookie['httponly'] = True
                
                # SameSite protection
                if 'samesite' not in cookie or not cookie['samesite']:
                    cookie['samesite'] = 'Lax'  # Lax for better compatibility
        
        return response
