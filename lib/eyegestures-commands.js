// eyegestures-commands.js - Command dispatcher for page context
(function() {
    'use strict';
    
    // Listen for commands from content script
    window.addEventListener('message', function(event) {
        if (event.source !== window) return;
        
        if (event.data.type === 'EYEGESTURES_COMMAND') {
            const command = event.data.command;
            const args = event.data.args || [];
            
            if (!window.__gazeTracker) {
                console.error('EyeGestures tracker not initialized');
                window.postMessage({ 
                    type: 'EYEGESTURES_COMMAND_RESULT', 
                    command: command,
                    success: false,
                    error: 'Tracker not initialized'
                }, '*');
                return;
            }
            
            if (typeof window.__gazeTracker[command] !== 'function') {
                console.error('Unknown command:', command);
                window.postMessage({ 
                    type: 'EYEGESTURES_COMMAND_RESULT', 
                    command: command,
                    success: false,
                    error: 'Unknown command'
                }, '*');
                return;
            }
            
            try {
                window.__gazeTracker[command].apply(window.__gazeTracker, args);
                console.log('EyeGestures command executed:', command);
                window.postMessage({ 
                    type: 'EYEGESTURES_COMMAND_RESULT', 
                    command: command,
                    success: true
                }, '*');
            } catch (error) {
                console.error('Error executing command:', command, error);
                window.postMessage({ 
                    type: 'EYEGESTURES_COMMAND_RESULT', 
                    command: command,
                    success: false,
                    error: error.message
                }, '*');
            }
        }
    });
    
    console.log('EyeGestures command dispatcher ready');
})();
