// eyegestures-init.js - Initialization script that runs in page context
(function() {
    'use strict';
    
    console.log('EyeGestures initialization script running');
    console.log('window.EyeGestures available:', typeof window.EyeGestures);
    
    if (typeof window.EyeGestures === 'undefined') {
        console.error('EyeGestures not found in page context');
        window.postMessage({ type: 'EYEGESTURES_INIT_FAILED', error: 'EyeGestures not available' }, '*');
        return;
    }
    
    if (typeof window.ML === 'undefined') {
        console.warn('ML.js not found in page context - this may cause issues');
    }
    
    try {
        console.log('Creating EyeGestures instance...');
        
        let wasCalibrating = false;
        
        window.__gazeTracker = new window.EyeGestures("gaze-video-element", function(point, calibration) {
            // Post message to content script with gaze data
            window.postMessage({
                type: 'GAZE_DATA',
                point: point ? { x: point[0], y: point[1] } : null,
                calibration: calibration
            }, '*');
            
            // Detect when calibration completes (transitions from true to false)
            if (wasCalibrating && !calibration) {
                console.log('Calibration transition detected: complete');
                window.postMessage({ type: 'CALIBRATION_COMPLETE' }, '*');
            }
            wasCalibrating = calibration;
        });
        
        console.log('EyeGestures instance created successfully');
        window.postMessage({ type: 'EYEGESTURES_READY', available: true }, '*');
        
    } catch (error) {
        console.error('Error creating EyeGestures instance:', error);
        window.postMessage({ 
            type: 'EYEGESTURES_INIT_FAILED', 
            error: error.message 
        }, '*');
    }
})();
