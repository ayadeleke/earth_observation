"""
Middleware package for Earth Observation Platform
"""

from .security import SecurityHeadersMiddleware, SecureCookieMiddleware

__all__ = ['SecurityHeadersMiddleware', 'SecureCookieMiddleware']
