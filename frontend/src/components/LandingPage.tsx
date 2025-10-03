import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface EcologicalImage {
  src: string;
  alt: string;
  caption: string;
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const ecologicalImages: EcologicalImage[] = [
    {
      src: '/images/forest.avif',
      alt: 'Lush Forest Canopy',
      caption: 'Protecting our forests for future generations'
    },
    {
      src: '/images/mountain forest.avif',
      alt: 'Mountain Landscape',
      caption: 'Monitoring Earth\'s changing landscapes'
    },
    {
      src: '/images/Water body.avif',
      alt: 'Ocean Waves',
      caption: 'Preserving our precious water resources'
    },
    {
      src: '/images/Snow mountain.avif',
      alt: 'Snow-Capped Mountains',
      caption: 'Supporting biodiversity through technology'
    },
    {
      src: '/images/desert forest.avif',
      alt: 'Desert Forest',
      caption: 'Analyzing environmental changes with precision'
    }
  ];

  // Cycle through images every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % ecologicalImages.length
      );
      setImageLoaded(false); // Reset loading state when changing images
    }, 5000);

    return () => clearInterval(interval);
  }, [ecologicalImages.length]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleTryDemo = () => {
    navigate('/demo');
  };



  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Slideshow Background */}
      <div className="absolute inset-0 z-0 bg-gray-900">
        <AnimatePresence>
          <motion.div
            key={currentImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img
              src={ecologicalImages[currentImageIndex].src}
              alt={ecologicalImages[currentImageIndex].alt}
              className="w-full h-full object-cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {imageError && (
              <div className="w-full h-full bg-gradient-to-br from-green-800 to-blue-900 flex items-center justify-center">
                <div className="text-white text-center">
                  <p className="text-xl mb-2">🌍</p>
                  <p>Earth Image Loading...</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow"
          >
            Protecting Our Planet Through
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
              Earth Observation
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="text-xl sm:text-2xl text-gray-200 mb-4 text-shadow max-w-3xl mx-auto leading-relaxed"
          >
            Join us in safeguarding our environment using advanced satellite imagery
            and AI-powered analysis to monitor, understand, and protect Earth's ecosystems.
          </motion.p>

          {/* Image Caption */}
          <motion.p
            key={currentImageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-lg text-green-300 mb-8 font-medium text-shadow"
          >
            {ecologicalImages[currentImageIndex].caption}
          </motion.p>

          {/* Environmental Message */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mb-10 max-w-2xl mx-auto"
          >
            <p className="text-lg text-gray-100 text-shadow leading-relaxed">
              Every action we take today shapes the world of tomorrow. Through cutting-edge 
              technology and environmental stewardship, we're building tools that help 
              preserve our planet's natural beauty and resources for future generations.
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleGetStarted}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-10 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl text-lg min-w-[200px]"
            >
              Get Started
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTryDemo}
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-800 font-semibold py-4 px-10 rounded-full transition-all duration-300 text-lg min-w-[200px]"
            >
              Try Demo
            </motion.button>


          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-white opacity-75"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Image Navigation Dots */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex space-x-2">
          {ecologicalImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentImageIndex 
                  ? 'bg-white shadow-lg' 
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;