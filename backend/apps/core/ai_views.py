from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
import json
import logging
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)


class AIQueryView(APIView):
    """AI Assistant for analyzing earth observation results"""
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self):
        super().__init__()
        self.ai_available = False
        self.ai_provider = None
        
        # Try to initialize AI provider
        try:
            ai_provider = getattr(settings, 'AI_PROVIDER', 'gemini').lower()
            logger.info(f"🔄 Initializing AI provider: {ai_provider}")
            
            if ai_provider == 'gemini' and hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY:
                self._init_gemini()
            else:
                logger.warning("❌ No valid AI provider configuration found")
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI provider: {str(e)}")
    
    def _init_gemini(self):
        """Initialize Google Gemini AI"""
        try:
            logger.info("🔄 Attempting to import Google Generative AI library...")
            import google.generativeai as genai
            logger.info(f"✅ Google Generative AI library imported successfully")
            
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model_name = getattr(settings, 'AI_ASSISTANT_MODEL', 'gemini-2.5-flash')
            logger.info(f"🔧 Using Gemini model: {model_name}")
            self.gemini_model = genai.GenerativeModel(model_name)
            self.ai_available = True
            self.ai_provider = 'gemini'
            logger.info("✅ Google Gemini AI initialized successfully")
            
        except ImportError as e:
            logger.error(f"❌ Google Generative AI library not available (ImportError): {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini: {str(e)}")
            import traceback
            logger.error(f"❌ Full traceback: {traceback.format_exc()}")
        
    def post(self, request):
        """Process AI query about analysis results"""
        try:
            # Validate request data exists and is accessible
            if not hasattr(request, 'data') or request.data is None:
                logger.error("Request data is None or not accessible")
                return Response(
                    {"error": "Invalid request - no data received"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Safely get request data with error handling
            try:
                user_message = request.data.get('message', '') if isinstance(request.data, dict) else ''
                analysis_data = request.data.get('analysisData', {}) if isinstance(request.data, dict) else {}
                context = request.data.get('context', []) if isinstance(request.data, dict) else []
            except (AttributeError, TypeError) as e:
                logger.error(f"Error accessing request data: {e}, data type: {type(request.data)}")
                return Response(
                    {"error": "Invalid request data format"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not user_message:
                return Response(
                    {"error": "Message is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate AI response
            ai_response = self._generate_ai_response(user_message, analysis_data, context)
            
            return Response({
                'success': True,
                'response': ai_response['content'],
                'suggestions': ai_response['suggestions'],
                'ai_used': self.ai_available,
                'provider': self.ai_provider
            })
            
        except Exception as e:
            logger.error(f"AI Query error: {str(e)}")
            return Response(
                {"error": "Failed to process AI query"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _generate_ai_response(self, user_message, analysis_data, context):
        """Generate AI response using available AI provider or local analysis"""
        
        # Extract key information from analysis data
        analysis_summary = self._extract_analysis_summary(analysis_data)
        
        # Add explicit debug logging
        logger.info(f"🔍 _generate_ai_response called. AI available: {self.ai_available}, Provider: {self.ai_provider}")
        logger.info(f"📊 Analysis data present: {bool(analysis_data)}")
        logger.info(f"📈 Has statistics: {bool(analysis_summary.get('statistics'))}")
        
        # Check if this is the first question (no previous context)
        is_first_question = not context or len(context) == 0
        
        # Always prioritize AI when available (only use rule-based as absolute fallback)
        if self.ai_available:
            logger.info(f"🚀 Using {self.ai_provider} API for comprehensive response")
            if self.ai_provider == 'gemini':
                return self._generate_gemini_response(user_message, analysis_summary, context, is_first_question)
        
        # Fallback to rule-based responses only when AI is not available
        logger.info("📝 Using rule-based responses (AI not available)")
        return self._generate_rule_based_response(user_message, analysis_summary, is_first_question)

    def _generate_gemini_response(self, user_message, analysis_summary, context, is_first_question=True):
        """Generate response using Google Gemini AI"""
        try:
            # Build conversation context
            system_prompt = f"""You are an expert AI assistant with comprehensive knowledge across all domains, with particular expertise in earth observation, remote sensing, and geospatial analysis.

You should provide helpful, accurate, and comprehensive responses to any question the user asks. While you have specialized expertise in earth observation and remote sensing, you are not limited to these topics and can discuss any subject.

Your Earth Observation Expertise Includes:
1. **Satellite Data & Analysis**: LST, NDVI, SAR, multispectral analysis, change detection
2. **Remote Sensing Platforms**: Landsat, Sentinel, MODIS, commercial satellites
3. **Applications**: Agriculture, forestry, urban planning, climate monitoring, disaster management
4. **Technical Concepts**: Spectral bands, atmospheric correction, geometric correction, classification
5. **Software & Tools**: GEE, ENVI, ArcGIS, QGIS, Python libraries (rasterio, GDAL, etc.)

Current Analysis Data (if relevant):
{json.dumps(analysis_summary, indent=2)}

Response Guidelines:
- Answer any question the user asks, not just earth observation topics
- For earth observation questions, provide technical depth and practical applications
- Use clear explanations with examples when helpful
- Include relevant context and real-world applications
- Use bullet points and formatting for clarity when appropriate
- Be conversational and helpful while maintaining accuracy

Previous conversation context:
{json.dumps(context[-3:], indent=2) if context else "No previous context"}

User question: {user_message}

Please provide a comprehensive, helpful response to the user's question."""
            
            # Generate response using Gemini
            response = self.gemini_model.generate_content(
                system_prompt,
                generation_config={
                    'max_output_tokens': getattr(settings, 'AI_ASSISTANT_MAX_TOKENS', 2000),
                    'temperature': getattr(settings, 'AI_ASSISTANT_TEMPERATURE', 0.7),
                }
            )
            
            ai_content = response.text
            
            # Only generate suggestions for the first question
            suggestions = self._generate_suggestions(user_message, analysis_summary) if is_first_question else []
            
            return {
                'content': ai_content,
                'suggestions': suggestions
            }
            
        except Exception as e:
            logger.error(f"Gemini API error: {str(e)}")
            
            # Check if it's a quota/billing error
            error_str = str(e).lower()
            if 'quota' in error_str or 'billing' in error_str or 'rate limit' in error_str:
                logger.warning("💳 Gemini API quota exceeded - falling back to rule-based responses")
                rule_response = self._generate_rule_based_response(user_message, analysis_summary, is_first_question)
                rule_response['content'] += "\n\n*Note: Enhanced AI responses temporarily unavailable due to API quota limits. Using basic knowledge base.*"
                return rule_response
            else:
                logger.warning(f"🔄 Gemini API error ({str(e)}) - falling back to rule-based responses")
                return self._generate_rule_based_response(user_message, analysis_summary, is_first_question)
    
    def _generate_rule_based_response(self, user_message, analysis_summary, is_first_question=True):
        """Generate response using rule-based logic"""
        
        message_lower = user_message.lower()
        analysis_type = analysis_summary.get('analysis_type', '').lower()
        statistics = analysis_summary.get('statistics', {})
        
        # First check for terminology/definition questions
        if self._is_terminology_question(message_lower):
            response = self._explain_terminology(message_lower)
        # Pattern matching for analysis-specific queries
        elif any(word in message_lower for word in ['trend', 'pattern', 'change']):
            response = self._analyze_trends(analysis_summary)
        elif any(word in message_lower for word in ['statistic', 'mean', 'average', 'value']):
            response = self._explain_statistics(analysis_summary)
        elif any(word in message_lower for word in ['anomaly', 'unusual', 'outlier']):
            response = self._identify_anomalies(analysis_summary)
        elif any(word in message_lower for word in ['insight', 'summary', 'overview']):
            response = self._provide_insights(analysis_summary)
        elif 'help' in message_lower or 'what can' in message_lower:
            response = self._provide_help(analysis_type)
        else:
            response = self._provide_general_response(analysis_summary)
        
        # Only generate suggestions for the first question
        suggestions = self._generate_suggestions(user_message, analysis_summary) if is_first_question else []
        
        return {
            'content': response,
            'suggestions': suggestions
        }
    
    def _is_terminology_question(self, message_lower):
        """Check if the message is asking about terminology/definitions"""
        terminology_patterns = [
            'what is', 'what does', 'define', 'explain', 'meaning of',
            'lst', 'ndvi', 'satellite', 'landsat', 'sentinel'
        ]
        return any(pattern in message_lower for pattern in terminology_patterns)
    
    def _explain_terminology(self, message_lower):
        """Explain earth observation terminology"""
        
        if 'lst' in message_lower:
            return """**LST (Land Surface Temperature)** is the temperature of the Earth's surface as measured from satellite sensors.

Key points about LST:
• **What it measures**: The thermal infrared radiation emitted from the land surface
• **Units**: Usually measured in Celsius (°C) or Kelvin (K)
• **Applications**: 
  - Urban heat island monitoring
  - Climate change studies
  - Agricultural monitoring
  - Water stress detection
• **Data sources**: Landsat, MODIS, Sentinel-3
• **Typical values**: Can range from -40°C to +70°C depending on location and season

LST is different from air temperature - it's specifically the surface temperature and can be much higher or lower than air temperature depending on conditions."""

        elif 'ndvi' in message_lower:
            return """**NDVI (Normalized Difference Vegetation Index)** is a measure of vegetation health and density.

Key points about NDVI:
• **Formula**: (NIR - Red) / (NIR + Red)
• **Range**: -1 to +1
• **Interpretation**:
  - Values < 0: Water, snow, clouds
  - 0 to 0.3: Bare soil, rock, sand
  - 0.3 to 0.7: Moderate vegetation
  - > 0.7: Dense, healthy vegetation
• **Applications**:
  - Crop monitoring
  - Forest health assessment
  - Drought monitoring
  - Land cover classification
• **Data sources**: Landsat, Sentinel-2, MODIS

Higher NDVI values indicate healthier, denser vegetation cover."""

        elif any(term in message_lower for term in ['landsat', 'satellite']):
            return """**Landsat** is a series of Earth observation satellites operated by NASA and USGS.

Key features:
• **Mission**: Continuous Earth observation since 1972
• **Current satellites**: Landsat 8 and Landsat 9
• **Spatial resolution**: 30m (visible/infrared), 100m (thermal)
• **Temporal resolution**: 16-day revisit cycle
• **Spectral bands**: 11 bands covering visible, near-infrared, and thermal infrared
• **Applications**: Land cover monitoring, agriculture, forestry, water resources, urban planning

Landsat provides free, open-access data that's widely used for environmental monitoring and research."""

        elif 'sentinel' in message_lower:
            return """**Sentinel** satellites are part of the European Copernicus Earth observation program.

Key missions:
• **Sentinel-1**: Radar imaging (SAR) for all-weather monitoring
• **Sentinel-2**: Optical imaging with high spatial resolution (10-60m)
• **Sentinel-3**: Ocean and land monitoring
• **Sentinel-5P**: Atmospheric monitoring

**Sentinel-2** is commonly used for vegetation analysis:
• 13 spectral bands
• 10m resolution for key bands
• 5-day revisit time
• Free and open data access"""

        elif 'sar' in message_lower or 'synthetic aperture radar' in message_lower or 'radar' in message_lower:
            return """**SAR (Synthetic Aperture Radar)** is an active remote sensing technique that uses radar waves to image the Earth's surface.

Key characteristics:
• **Active sensor**: Transmits its own energy (radar pulses) and measures the return signal
• **All-weather capability**: Works through clouds, rain, and in darkness
• **Polarization**: Can transmit and receive in different polarizations (VV, VH, HH, HV)
• **Applications**:
  - Surface deformation monitoring (earthquakes, landslides)
  - Flood mapping and monitoring
  - Ice and snow monitoring
  - Ship detection and tracking
  - Forest biomass estimation
  - Urban monitoring

**Advantages**:
• Day/night operation
• Weather-independent
• High spatial resolution possible
• Can penetrate through vegetation

**Common SAR satellites**: Sentinel-1, RADARSAT, TerraSAR-X, ALOS PALSAR

SAR data appears different from optical imagery - it shows surface roughness and dielectric properties rather than color."""

        else:
            return """I can explain various earth observation terms! Try asking about:

• **LST** - Land Surface Temperature
• **NDVI** - Normalized Difference Vegetation Index  
• **SAR** - Synthetic Aperture Radar
• **Landsat** - NASA's Earth observation satellites
• **Sentinel** - European Space Agency satellites
• **Remote sensing** concepts and applications

What specific term would you like me to explain?"""
    
    def _extract_analysis_summary(self, analysis_data):
        """Extract key information from analysis data"""
        # Ensure analysis_data is a dictionary
        if not analysis_data or not isinstance(analysis_data, dict):
            analysis_data = {}
            
        return {
            'analysis_type': analysis_data.get('analysisType', ''),
            'satellite': analysis_data.get('satellite', ''),
            'date_range': f"{analysis_data.get('startDate', '')} to {analysis_data.get('endDate', '')}",
            'statistics': analysis_data.get('statistics', {}),
            'time_series_length': len(analysis_data.get('timeSeriesData', [])),
            'cloud_cover': analysis_data.get('cloudCover', 'Unknown'),
            'cloud_masking': analysis_data.get('enableCloudMasking', False)
        }
    
    def _analyze_trends(self, summary):
        """Analyze trends in the data"""
        analysis_type = summary.get('analysis_type', '').upper()
        stats = summary.get('statistics', {})
        
        if analysis_type == 'NDVI':
            mean_val = stats.get('mean', 0)
            if mean_val > 0.7:
                return f"Your NDVI analysis shows healthy vegetation with a mean value of {mean_val:.3f}. This indicates dense, productive vegetation cover in your study area."
            elif mean_val > 0.4:
                return f"Your NDVI analysis shows moderate vegetation with a mean value of {mean_val:.3f}. This suggests mixed vegetation or agricultural areas."
            else:
                return f"Your NDVI analysis shows sparse vegetation with a mean value of {mean_val:.3f}. This could indicate bare soil, water, or urban areas."
        
        elif analysis_type == 'LST':
            mean_temp = stats.get('mean', 0)
            return f"Your Land Surface Temperature analysis shows an average temperature of {mean_temp:.1f}°C. This can help identify thermal patterns and urban heat islands."
        
        return f"Your {analysis_type} analysis shows interesting patterns. The data spans {summary.get('time_series_length', 0)} observations over your selected time period."
    
    def _explain_statistics(self, summary):
        """Explain statistical values"""
        stats = summary.get('statistics', {})
        analysis_type = summary.get('analysis_type', '').upper()
        
        response = f"Here are your {analysis_type} statistics:\n\n"
        
        for key, value in stats.items():
            if isinstance(value, (int, float)):
                if 'mean' in key.lower():
                    response += f"• Mean: {value:.3f} - This is the average value across all measurements\n"
                elif 'std' in key.lower():
                    response += f"• Standard Deviation: {value:.3f} - This shows how much variation exists in your data\n"
                elif 'min' in key.lower():
                    response += f"• Minimum: {value:.3f} - The lowest value recorded\n"
                elif 'max' in key.lower():
                    response += f"• Maximum: {value:.3f} - The highest value recorded\n"
        
        return response or "No statistical data available for this analysis."
    
    def _identify_anomalies(self, summary):
        """Identify potential anomalies"""
        stats = summary.get('statistics', {})
        mean_val = stats.get('mean', 0)
        std_val = stats.get('std', 0)
        min_val = stats.get('min', 0)
        max_val = stats.get('max', 0)
        
        anomalies = []
        
        if std_val > 0:
            # Check for high variation
            cv = std_val / mean_val if mean_val != 0 else 0
            if cv > 0.5:
                anomalies.append("High variation detected - this could indicate diverse land cover or temporal changes")
        
        # Check for extreme values (simplified approach)
        if std_val > 0 and mean_val > 0:
            z_min = abs((min_val - mean_val) / std_val)
            z_max = abs((max_val - mean_val) / std_val)
            
            if z_min > 3:
                anomalies.append(f"Unusually low values detected (minimum: {min_val:.3f})")
            if z_max > 3:
                anomalies.append(f"Unusually high values detected (maximum: {max_val:.3f})")
        
        if anomalies:
            return "Potential anomalies detected:\n\n" + "\n".join(f"• {anomaly}" for anomaly in anomalies)
        else:
            return "No significant anomalies detected in your data. The values appear to be within normal ranges."
    
    def _provide_insights(self, summary):
        """Provide general insights"""
        analysis_type = summary.get('analysis_type', '').upper()
        time_series_length = summary.get('time_series_length', 0)
        date_range = summary.get('date_range', '')
        
        insights = f"Analysis Overview:\n\n"
        insights += f"• Type: {analysis_type} analysis\n"
        insights += f"• Satellite: {summary.get('satellite', 'Unknown').title()}\n"
        insights += f"• Period: {date_range}\n"
        insights += f"• Observations: {time_series_length} data points\n"
        
        if summary.get('cloud_masking'):
            insights += f"• Cloud masking was applied to improve data quality\n"
        
        # Add type-specific insights
        if analysis_type == 'NDVI':
            insights += f"\nNDVI measures vegetation health and density. Values range from -1 to 1, with higher values indicating healthier vegetation."
        elif analysis_type == 'LST':
            insights += f"\nLST shows surface temperature patterns, useful for understanding thermal environments and climate effects."
        
        return insights
    
    def _provide_help(self, analysis_type):
        """Provide help information"""
        return f"""I can help you understand your {analysis_type.upper()} analysis results! Here's what I can do:

• Explain trends and patterns in your data
• Interpret statistical values and their meaning
• Identify anomalies or unusual values
• Provide insights about vegetation health, temperature patterns, or land use
• Compare different time periods or analysis types
• Suggest follow-up analyses

What would you like to know about your results?"""
    
    def _provide_general_response(self, summary):
        """Provide a general response"""
        analysis_type = summary.get('analysis_type', '').upper()
        return f"I can see you have {analysis_type} analysis results. I can help explain the data, identify trends, or answer specific questions about your findings. What would you like to know?"
    
    def _generate_suggestions(self, user_message, summary):
        """Generate follow-up suggestions"""
        analysis_type = summary.get('analysis_type', '').lower()
        message_lower = user_message.lower()
        
        # Base suggestions
        suggestions = []
        
        # If asking about terminology, suggest related terms
        if any(term in message_lower for term in ['what is', 'define', 'explain']):
            suggestions = [
                "What is NDVI?",
                "What is LST?", 
                "Explain Landsat satellites",
                "What does remote sensing mean?"
            ]
        # If asking about analysis results
        elif analysis_type:
            suggestions = [
                "What do these statistics mean?",
                "Explain the trends in my data",
                "Are there any anomalies?"
            ]
            
            if analysis_type == 'ndvi':
                suggestions.extend([
                    "How healthy is the vegetation?",
                    "What's the vegetation trend over time?"
                ])
            elif analysis_type == 'lst':
                suggestions.extend([
                    "What do these temperature patterns indicate?",
                    "How does temperature vary spatially?"
                ])
        else:
            # General suggestions
            suggestions = [
                "What is LST?",
                "What is NDVI?",
                "How do I interpret my results?",
                "What analysis should I run next?"
            ]
        
        return suggestions[:4]  # Return up to 4 suggestions