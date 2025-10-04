import React, { useState, useEffect, useMemo } from 'react';
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
  
  const ecologicalImages: EcologicalImage[] = useMemo(() => [
    {
      src: '/images/forest.avif',
      alt: 'Lush Forest Canopy',
      caption: 'Protecting our forests for future generations'
    },
    {
      src: '/images/mountain_forest.avif',
      alt: 'Mountain Landscape',
      caption: 'Monitoring Earth\'s changing landscapes'
    },
    {
      src: '/images/Water_body.avif',
      alt: 'Ocean Waves',
      caption: 'Preserving our precious water resources'
    },
    {
      src: '/images/Snow_mountain.avif',
      alt: 'Snow-Capped Mountains',
      caption: 'Supporting biodiversity through technology'
    },
    {
      src: '/images/desert_forest.avif',
      alt: 'Desert Forest',
      caption: 'Analyzing environmental changes with precision'
    }
  ], []);

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

  // Debug log current image and preload next image
  useEffect(() => {
    const currentImage = ecologicalImages[currentImageIndex];
    console.log('Current image:', currentImage.src);
    
    // Preload the current image to ensure smooth transitions
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setImageError(false);
    };
    img.onerror = () => {
      console.error('Failed to load image:', currentImage.src);
      setImageError(true);
      setImageLoaded(false);
    };
    img.src = currentImage.src;
    
    // Preload next image for smoother transitions
    const nextIndex = (currentImageIndex + 1) % ecologicalImages.length;
    const nextImg = new Image();
    nextImg.src = ecologicalImages[nextIndex].src;
  }, [currentImageIndex, ecologicalImages]);



  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleTryDemo = () => {
    navigate('/demo');
  };



  return (
    <div 
      className="position-relative min-vh-100 overflow-hidden"
      style={{
        backgroundColor: '#1a1a2e', // Fallback color
        backgroundImage: imageError ? 'none' : `url('${ecologicalImages[currentImageIndex].src}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: window.innerWidth > 768 ? 'fixed' : 'scroll', // Fixed on desktop, scroll on mobile
        transition: 'background-image 0.8s ease-in-out'
      }}
    >
      {/* Background overlay for text readability */}
      <div 
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{ 
          backgroundColor: imageError ? 'rgba(26, 26, 46, 0.8)' : 'rgba(0, 0, 0, 0.5)',
          zIndex: 1,
          transition: 'background-color 0.3s ease'
        }}
      />

      {/* Loading indicator */}
      {!imageLoaded && !imageError && (
        <div 
          className="position-absolute top-50 start-50 translate-middle text-white"
          style={{ zIndex: 3 }}
        >
          <div className="d-flex align-items-center">
            <div 
              className="spinner-border spinner-border-sm me-2" 
              role="status"
              aria-hidden="true"
            />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Main content container */}
      <div className="position-relative d-flex flex-column min-vh-100" style={{ zIndex: 2 }}>
        {/* Hero content */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-12 col-lg-10 col-xl-8 text-center">
                {/* Main Heading */}
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="display-1 fw-bold text-white mb-4"
                  style={{ 
                    fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                    textShadow: '3px 3px 6px rgba(0,0,0,0.7)',
                    lineHeight: '1.1'
                  }}
                >
                  Protecting Our Planet Through{' '}
                  <span 
                    className="d-inline-block"
                    style={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: 'none'
                    }}
                  >
                    Earth Observation
                  </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="lead text-light mb-4"
                  style={{ 
                    fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                    lineHeight: '1.6',
                    maxWidth: '700px',
                    margin: '0 auto'
                  }}
                >
                  Join us in safeguarding our environment using advanced satellite imagery
                  and AI-powered analysis to monitor, understand, and protect Earth's ecosystems.
                </motion.p>

                {/* Image Caption */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentImageIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6 }}
                    className="h5 text-success fw-medium mb-4"
                    style={{ 
                      textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                      fontStyle: 'italic'
                    }}
                  >
                    {ecologicalImages[currentImageIndex].caption}
                  </motion.p>
                </AnimatePresence>

                {/* Environmental Message */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.6 }}
                  className="mb-5"
                >
                  <p 
                    className="text-white"
                    style={{ 
                      fontSize: 'clamp(1rem, 1.5vw, 1.2rem)',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                      lineHeight: '1.6',
                      maxWidth: '800px',
                      margin: '0 auto'
                    }}
                  >
                    Every action we take today shapes the world of tomorrow. Through cutting-edge 
                    technology and environmental stewardship, we're building tools that help 
                    preserve our planet's natural beauty and resources for future generations.
                  </p>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className="d-flex flex-column flex-sm-row gap-3 justify-content-center align-items-center mb-5"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGetStarted}
                    className="btn btn-success fw-semibold py-3 px-5 rounded-pill shadow-lg"
                    style={{ 
                      minWidth: '180px',
                      fontSize: 'clamp(1rem, 1.2vw, 1.1rem)'
                    }}
                  >
                    Get Started
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTryDemo}
                    className="btn btn-outline-light fw-semibold py-3 px-5 rounded-pill"
                    style={{ 
                      minWidth: '180px',
                      fontSize: 'clamp(1rem, 1.2vw, 1.1rem)',
                      borderWidth: '2px'
                    }}
                  >
                    Try Demo
                  </motion.button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section with navigation and scroll indicator */}
        <div className="pb-4">
          {/* Image Navigation Dots */}
          <div className="d-flex justify-content-center mb-4">
            <div className="d-flex gap-2">
              {ecologicalImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`border-0 rounded-circle transition-all ${
                    index === currentImageIndex 
                      ? 'bg-white shadow' 
                      : 'bg-white bg-opacity-50'
                  }`}
                  style={{ 
                    width: '14px', 
                    height: '14px',
                    transition: 'all 0.3s ease',
                    opacity: index === currentImageIndex ? 1 : 0.7,
                    transform: index === currentImageIndex ? 'scale(1.2)' : 'scale(1)'
                  }}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="d-flex justify-content-center"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="text-white opacity-75"
            >
              <svg 
                style={{ width: '24px', height: '24px' }} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                className="drop-shadow"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;