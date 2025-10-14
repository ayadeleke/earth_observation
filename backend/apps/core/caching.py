"""
Enhanced caching utilities for Earth observation analysis with Redis support.
Provides decorators and utilities for caching analysis results and Earth Engine data.
"""

import functools
import hashlib
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Union

from django.core.cache import cache, caches
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CacheManager:
    """Enhanced cache manager with Redis support and multiple cache backends"""
    
    def __init__(self):
        self.default_cache = cache  # Default cache (Redis DB 1)
        try:
            self.session_cache = caches['sessions']  # Session cache (Redis DB 2)
            self.analysis_cache = caches['analysis']  # Analysis cache (Redis DB 3)
        except Exception as e:
            logger.warning(f"Redis cache not available, falling back to default: {e}")
            self.session_cache = cache
            self.analysis_cache = cache
    
    def get_cache_key(self, prefix: str, **kwargs) -> str:
        """Generate a consistent cache key from parameters"""
        key_data = {
            'prefix': prefix,
            **kwargs
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"{prefix}:{key_hash}"
    
    def set_analysis_result(self, key: str, data: Any, timeout: int = 7200) -> bool:
        """Cache analysis results with metadata"""
        try:
            cache_data = {
                'data': data,
                'timestamp': timezone.now().isoformat(),
                'cache_type': 'analysis_result'
            }
            self.analysis_cache.set(key, cache_data, timeout)
            logger.info(f"✅ Cached analysis result: {key[:50]}...")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to cache analysis result {key}: {str(e)}")
            return False
    
    def get_analysis_result(self, key: str) -> Optional[Any]:
        """Retrieve cached analysis results"""
        try:
            cached_data = self.analysis_cache.get(key)
            if cached_data:
                logger.info(f"🎯 Cache HIT for analysis: {key[:50]}...")
                return cached_data.get('data')
            else:
                logger.info(f"❌ Cache MISS for analysis: {key[:50]}...")
                return None
        except Exception as e:
            logger.error(f"❌ Cache retrieval error for {key}: {str(e)}")
            return None
    
    def set_earth_engine_data(self, key: str, data: Any, timeout: int = 3600) -> bool:
        """Cache Earth Engine data with shorter timeout"""
        try:
            cache_data = {
                'data': data,
                'timestamp': timezone.now().isoformat(),
                'cache_type': 'earth_engine_data'
            }
            self.default_cache.set(key, cache_data, timeout)
            logger.info(f"🌍 Cached Earth Engine data: {key[:50]}...")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to cache Earth Engine data {key}: {str(e)}")
            return False
    
    def get_earth_engine_data(self, key: str) -> Optional[Any]:
        """Retrieve cached Earth Engine data"""
        try:
            cached_data = self.default_cache.get(key)
            if cached_data:
                logger.info(f"🌍 Cache HIT for Earth Engine: {key[:50]}...")
                return cached_data.get('data')
            else:
                logger.info(f"❌ Cache MISS for Earth Engine: {key[:50]}...")
                return None
        except Exception as e:
            logger.error(f"❌ Cache retrieval error for {key}: {str(e)}")
            return None
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache keys matching a pattern"""
        try:
            # Redis-specific pattern deletion
            from django_redis import get_redis_connection
            
            deleted_count = 0
            for cache_alias in ['default', 'analysis']:
                try:
                    redis_conn = get_redis_connection(cache_alias)
                    keys = redis_conn.keys(f"*{pattern}*")
                    if keys:
                        deleted_count += redis_conn.delete(*keys)
                except Exception as e:
                    logger.warning(f"Pattern deletion failed for {cache_alias}: {e}")
            
            logger.info(f"🗑️ Invalidated {deleted_count} cache keys matching pattern: {pattern}")
            return deleted_count
        except Exception as e:
            logger.error(f"❌ Failed to invalidate pattern {pattern}: {str(e)}")
            return 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get Redis cache statistics"""
        try:
            from django_redis import get_redis_connection
            
            stats = {}
            for cache_alias in ['default', 'sessions', 'analysis']:
                try:
                    redis_conn = get_redis_connection(cache_alias)
                    info = redis_conn.info()
                    stats[cache_alias] = {
                        'keys': redis_conn.dbsize(),
                        'memory_usage': info.get('used_memory_human', 'N/A'),
                        'connected_clients': info.get('connected_clients', 0),
                        'uptime': info.get('uptime_in_seconds', 0),
                    }
                except Exception as e:
                    stats[cache_alias] = {'error': str(e)}
            
            return stats
        except Exception as e:
            logger.error(f"❌ Failed to get cache stats: {str(e)}")
            return {'error': str(e)}
    
    def clear_all_caches(self) -> bool:
        """Clear all cache databases"""
        try:
            self.default_cache.clear()
            self.session_cache.clear()
            self.analysis_cache.clear()
            logger.info("🗑️ Cleared all cache databases")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to clear caches: {str(e)}")
            return False


# Global cache manager instance
cache_manager = CacheManager()


def cache_analysis_result(timeout: int = 7200, key_prefix: str = "analysis"):
    """
    Enhanced decorator for caching analysis results with Redis support
    
    Args:
        timeout: Cache timeout in seconds (default: 2 hours)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function arguments
            cache_key = cache_manager.get_cache_key(
                prefix=f"{key_prefix}_{func.__name__}",
                args=str(args),
                kwargs=kwargs
            )
            
            # Try to get from cache first
            cached_result = cache_manager.get_analysis_result(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Cache the result
            cache_manager.set_analysis_result(cache_key, result, timeout)
            
            logger.info(f"⚡ Function {func.__name__} executed in {execution_time:.2f}s and cached")
            return result
        
        return wrapper
    return decorator


def cache_earth_engine_data(timeout: int = 3600, key_prefix: str = "ee_data"):
    """
    Enhanced decorator for caching Earth Engine data with Redis support
    
    Args:
        timeout: Cache timeout in seconds (default: 1 hour)
        key_prefix: Prefix for cache keys
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function arguments
            cache_key = cache_manager.get_cache_key(
                prefix=f"{key_prefix}_{func.__name__}",
                args=str(args),
                kwargs=kwargs
            )
            
            # Try to get from cache first
            cached_result = cache_manager.get_earth_engine_data(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Cache the result
            cache_manager.set_earth_engine_data(cache_key, result, timeout)
            
            logger.info(f"🌍 Earth Engine function {func.__name__} executed in {execution_time:.2f}s and cached")
            return result
        
        return wrapper
    return decorator


def monitor_performance(func: Callable) -> Callable:
    """Enhanced performance monitoring decorator"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        start_memory = None
        
        try:
            import psutil
            process = psutil.Process()
            start_memory = process.memory_info().rss / 1024 / 1024  # MB
        except ImportError:
            pass
        
        result = func(*args, **kwargs)
        
        execution_time = time.time() - start_time
        
        if start_memory:
            try:
                end_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_diff = end_memory - start_memory
                logger.info(f"📊 {func.__name__}: {execution_time:.2f}s, Memory: {memory_diff:+.1f}MB")
            except:
                logger.info(f"📊 {func.__name__}: {execution_time:.2f}s")
        else:
            logger.info(f"📊 {func.__name__}: {execution_time:.2f}s")
        
        return result
    
    return wrapper


# Legacy aliases and compatibility
class AnalysisCache:
    """Legacy compatibility class for existing code"""
    
    def __init__(self, cache_name='default'):
        self.cache_manager = cache_manager
    
    def get_cached_result(self, cache_key):
        """Get cached analysis result - legacy compatibility"""
        return self.cache_manager.get_analysis_result(cache_key)
    
    def cache_result(self, cache_key, result, timeout=3600):
        """Cache analysis result - legacy compatibility"""
        return self.cache_manager.set_analysis_result(cache_key, result, timeout)