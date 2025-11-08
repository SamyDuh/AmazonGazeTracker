
console.log("Amazon Gaze Tracker Extension Loaded - Using EyeGestures");

class AmazonGazeTracker {
    constructor() {
        this.gestures = null;
        this.isTracking = false;
        this.gazeData = [];
        this.sessionStartTime = null;
        this.calibrationComplete = false;
        this.eyeGesturesReady = false;
        this.eyeGesturesError = null;
        this.lastSampleTime = 0;
        this.settings = {
            duration: 60000, // 1 minute
            samplingRate: 500, // Sample every 500ms
            filename: 'gaze_product_data'
        };
        
        this.initializeTracking();
    }
    
    async initializeTracking() {
        try {
            console.log("Initializing EyeGestures...");
            
            this.createRequiredElements();
            await this.loadEyeGesturesLibrary();
            this.setupPageContextListener();
            
            // Load command dispatcher and init scripts
            await this.injectScript(chrome.runtime.getURL('lib/eyegestures-commands.js'));
            await this.injectScript(chrome.runtime.getURL('lib/eyegestures-init.js'));
            
            await this.waitForInitialization();
            
            this.gestures = {
                start: () => this.sendCommandToPage('start'),
                stop: () => this.sendCommandToPage('stop')
            };
            
            console.log('EyeGestures initialized successfully');
            
            // Auto-start tracking after 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            await this.startSession();
            
        } catch (error) {
            console.error('Error initializing gaze tracker:', error);
        }
    }
    
    setupPageContextListener() {
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;
            
            if (event.data.type === 'GAZE_DATA') {
                this.handleGazeData(event.data.point, event.data.calibration);
            } else if (event.data.type === 'EYEGESTURES_READY') {
                this.eyeGesturesReady = true;
            } else if (event.data.type === 'EYEGESTURES_INIT_FAILED') {
                console.error('EyeGestures initialization failed:', event.data.error);
                this.eyeGesturesError = event.data.error;
            } else if (event.data.type === 'EYEGESTURES_COMMAND_RESULT') {
                if (!event.data.success) {
                    console.error('Command failed:', event.data.command, event.data.error);
                }
            } else if (event.data.type === 'CALIBRATION_COMPLETE') {
                console.log('Calibration completed!');
                this.onCalibrationComplete();
            }
        });
    }
    
    onCalibrationComplete() {
        if (this.calibrationComplete) return;
        this.calibrationComplete = true;
        
        console.log("Starting gaze data collection...");
        this.sessionStartTime = Date.now();
        this.isTracking = true;
        
        // Auto-stop after duration and download CSV
        setTimeout(() => {
            if (this.isTracking) {
                console.log("Gaze tracking complete. Downloading data...");
                this.stopSession();
            }
        }, this.settings.duration);
    }
    
    waitForInitialization() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (this.eyeGesturesReady) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (this.eyeGesturesError) {
                    clearInterval(checkInterval);
                    reject(new Error(this.eyeGesturesError));
                }
            }, 100);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.eyeGesturesReady) {
                    reject(new Error('Timeout waiting for EyeGestures initialization'));
                }
            }, 5000);
        });
    }
    
    sendCommandToPage(command, args = []) {
        // Send command via postMessage to the command dispatcher in page context
        window.postMessage({
            type: 'EYEGESTURES_COMMAND',
            command: command,
            args: args
        }, '*');
    }
    
    createRequiredElements() {
        // Create video element (hidden)
        if (!document.getElementById('gaze-video-element')) {
            const video = document.createElement('video');
            video.id = 'gaze-video-element';
            video.width = 640;
            video.height = 480;
            video.autoplay = true;
            video.style.cssText = 'display: none !important; position: fixed; z-index: -1;';
            document.body.appendChild(video);
        }
        
        // Create status div (hidden)
        if (!document.getElementById('gaze-status')) {
            const status = document.createElement('div');
            status.id = 'gaze-status';
            status.style.cssText = 'display: none !important;';
            status.textContent = 'Initializing...';
            document.body.appendChild(status);
        }
        
        // Create error div (hidden)
        if (!document.getElementById('gaze-error')) {
            const error = document.createElement('div');
            error.id = 'gaze-error';
            error.style.cssText = 'display: none !important;';
            document.body.appendChild(error);
        }
    }
    
    async loadEyeGesturesLibrary() {
        await this.injectScript(chrome.runtime.getURL('lib/ml.min.js'));
        await this.injectScript(chrome.runtime.getURL('lib/eyegestures.browser.js'));
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    injectScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            (document.head || document.documentElement).appendChild(script);
        });
    }
    
    async startSession() {
        try {
            this.gazeData = [];
            
            if (!this.gestures) {
                await this.initializeTracking();
            }
            
            await this.gestures.start();
            console.log(`Gaze tracking session started for ${this.settings.duration}ms`);
            
        } catch (error) {
            console.error('Error starting gaze tracking session:', error);
            throw error;
        }
    }
    
    stopSession() {
        try {
            if (this.gestures && this.gestures.stop) {
                this.gestures.stop();
            }
            
            this.isTracking = false;
            
            console.log('Gaze tracking session stopped');
            console.log('Total data points collected:', this.gazeData.length);
            
            this.downloadCSV();
            
        } catch (error) {
            console.error('Error stopping gaze tracking session:', error);
        }
    }
    
    async handleGazeData(point, calibration) {
        if (!this.isTracking || !point) return;
        
        const timestamp = Date.now();
        
        // Throttle to 500ms sampling rate
        if (timestamp - this.lastSampleTime < this.settings.samplingRate) {
            return;
        }
        
        this.lastSampleTime = timestamp;
        const relativeTime = timestamp - this.sessionStartTime;
        
        const productData = await this.getProductDetails(point.x, point.y);
        
        if (productData) {
            const dataPoint = {
                x: point.x.toFixed(2),
                y: point.y.toFixed(2),
                timeElapsed: relativeTime.toFixed(2),
                title: productData.title,
                price: productData.price,
                rating: productData.rating,
                url: productData.url,
                image: productData.image,
                timestamp: timestamp,
                calibrated: calibration || false
            };
            
            this.gazeData.push(dataPoint);
            console.log(`Data point ${this.gazeData.length}: ${productData.title} | ${productData.price}`);
        }
    }
    

    // Wait for element with polling inside shadow roots
    async waitForElement(selector, root, timeout = 1000) {
        const pollInterval = 50;
        const maxTries = timeout / pollInterval;
        let tries = 0;

        return new Promise(resolve => {
            const interval = setInterval(() => {
                const el = root?.querySelector(selector);
                if (el || tries >= maxTries) {
                    clearInterval(interval);
                    resolve(el);
                }
                tries++;
            }, pollInterval);
        });
    }

    async getProductDetails(x, y) {
        const element = document.elementFromPoint(x, y);
        if (!element) return null;

        const faceout = element.closest("bds-unified-book-faceout");
        if (!faceout || !faceout.shadowRoot) return null;

        const faceoutShadow = faceout.shadowRoot;

        // ---------- Title ----------
        let title = "N/A";
        try {
            const titleComp = faceoutShadow.querySelector("bds-book-title-content");
            const shadow1 = titleComp?.shadowRoot;
            const bookTitleContent = shadow1?.querySelector("div.bookTitleContent");
            const primaryText = bookTitleContent?.querySelector("div.primaryTextOnly");
            const a = primaryText?.querySelector("a");

            if (a && a.shadowRoot == null) {
                const h3 = await this.waitForElement("h3", a, 1000);
                title = h3?.innerText?.trim() || "N/A";
            }
        } catch (e) {
            console.warn("Title extraction error:", e);
        }

        // ---------- Price ----------
        let price = "N/A";
        try {
            const priceComponent = faceoutShadow.querySelector("bds-book-price");
            const priceShadow = priceComponent?.shadowRoot;
            const priceEl = priceShadow?.querySelector("span.offscreen");
            if (priceEl) price = priceEl.innerText.trim();
        } catch (e) {
            console.warn("Price extraction error:", e);
        }

        // ---------- Rating ----------
        let rating = "N/A";
        try {
            const ratingComponent = faceoutShadow.querySelector("bds-star-rating");
            const ratingShadow = ratingComponent?.shadowRoot;
            const ratingEl = ratingShadow?.querySelector("span.rating");
            if (ratingEl) rating = ratingEl.innerText.trim();
        } catch (e) {
            console.warn("Rating extraction error:", e);
        }

        // ---------- Image ----------
        let image = "N/A";
        try {
            const imageComponent = faceoutShadow.querySelector("bds-book-cover-image");
            const imageShadow = imageComponent?.shadowRoot;
            const img = imageShadow?.querySelector("img.coverImage");
            if (img) {
                const srcset = img.getAttribute("srcset");
                if (srcset) {
                    image = srcset.split(',')[0].trim().split(' ')[0];
                } else {
                    image = img.src;
                }
            }
        } catch (e) {
            console.warn("Image extraction error:", e);
        }

        // ---------- URL ----------
        let url = "N/A";
        try {
            const a = faceoutShadow.querySelector("a[href*='/dp/']");
            const href = a?.getAttribute("href");
            if (href) url = "https://www.amazon.com" + href;
        } catch (e) {
            console.warn("URL extraction error:", e);
        }

        return { title, price, rating, image, url };
    }
    
    downloadCSV() {
        if (this.gazeData.length === 0) {
            console.warn("No gaze data collected!");
            return;
        }

        let csvContent = "x,y,timeElapsed,Title,Price,Rating,URL,Image\n";
        this.gazeData.forEach(row => {
            csvContent += `${row.x},${row.y},${row.timeElapsed},"${row.title}","${row.price}","${row.rating}","${row.url}","${row.image}"\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "gaze_product_data.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log("Gaze tracking complete. Data downloaded.");
    }
}

// Initialize Amazon gaze tracker when content script loads
const amazonGazeTracker = new AmazonGazeTracker();

// Make available globally for debugging
window.amazonGazeTracker = amazonGazeTracker;

/* SearchGazer implementation */
/*
console.log("Amazon Gaze Tracker Extension Loaded");

(async function () {
    console.log("Initializing SearchGazer...");

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('searchgazer.js');
    document.head.appendChild(script);

    script.onload = function () {
        console.log("SearchGazer Loaded. Initializing...");

        webgazer.setTracker('TFFacemesh')
            .setRegression('ridge')
            .showVideoPreview(true)
            .showFaceOverlay(true)
            .showFaceFeedbackBox(true)
            .showPredictionPoints(true)
            .begin();

        let gazeData = [];

        // Wait for element with polling inside shadow roots
        async function waitForElement(selector, root, timeout = 1000) {
            const pollInterval = 50;
            const maxTries = timeout / pollInterval;
            let tries = 0;

            return new Promise(resolve => {
                const interval = setInterval(() => {
                    const el = root?.querySelector(selector);
                    if (el || tries >= maxTries) {
                        clearInterval(interval);
                        resolve(el);
                    }
                    tries++;
                }, pollInterval);
            });
        }

        async function getProductDetails(x, y) {
            const element = document.elementFromPoint(x, y);
            if (!element) return null;

            const faceout = element.closest("bds-unified-book-faceout");
            if (!faceout || !faceout.shadowRoot) return null;

            const faceoutShadow = faceout.shadowRoot;

            // ---------- Title ----------
            let title = "N/A";
            try {
                const titleComp = faceoutShadow.querySelector("bds-book-title-content");
                const shadow1 = titleComp?.shadowRoot;
                const bookTitleContent = shadow1?.querySelector("div.bookTitleContent");
                const primaryText = bookTitleContent?.querySelector("div.primaryTextOnly");
                const a = primaryText?.querySelector("a");

                if (a && a.shadowRoot == null) {
                    const h3 = await waitForElement("h3", a, 1000);
                    title = h3?.innerText?.trim() || "N/A";
                }
            } catch (e) {
                console.warn("Title extraction error:", e);
            }

            // ---------- Price ----------
            let price = "N/A";
            try {
                const priceComponent = faceoutShadow.querySelector("bds-book-price");
                const priceShadow = priceComponent?.shadowRoot;
                const priceEl = priceShadow?.querySelector("span.offscreen");
                if (priceEl) price = priceEl.innerText.trim();
            } catch (e) {
                console.warn("Price extraction error:", e);
            }

            // ---------- Rating ----------
            let rating = "N/A";
            try {
                const ratingComponent = faceoutShadow.querySelector("bds-star-rating");
                const ratingShadow = ratingComponent?.shadowRoot;
                const ratingEl = ratingShadow?.querySelector("span.rating");
                if (ratingEl) rating = ratingEl.innerText.trim();
            } catch (e) {
                console.warn("Rating extraction error:", e);
            }

            // ---------- Image ----------
            let image = "N/A";
            try {
                const imageComponent = faceoutShadow.querySelector("bds-book-cover-image");
                const imageShadow = imageComponent?.shadowRoot;
                const img = imageShadow?.querySelector("img.coverImage");
                if (img) {
                    const srcset = img.getAttribute("srcset");
                    if (srcset) {
                        image = srcset.split(',')[0].trim().split(' ')[0];
                    } else {
                        image = img.src;
                    }
                }
            } catch (e) {
                console.warn("Image extraction error:", e);
            }

            // ---------- URL ----------
            let url = "N/A";
            try {
                const a = faceoutShadow.querySelector("a[href*='/dp/']");
                const href = a?.getAttribute("href");
                if (href) url = "https://www.amazon.com" + href;
            } catch (e) {
                console.warn("URL extraction error:", e);
            }

            console.log("Extracted from Shadow DOM:");
            console.log("Title:", title);
            console.log("Price:", price);
            console.log("Rating:", rating);
            console.log("Image:", image);
            console.log("URL:", url);

            return { title, price, rating, image, url };
        }

        async function recordGazeData(x, y, timeElapsed) {
            const productData = await getProductDetails(x, y);
            if (productData) {
                console.log(`Gaze on Product: ${productData.title} | Price: ${productData.price} | Rating: ${productData.rating}`);

                gazeData.push({
                    x: x.toFixed(2),
                    y: y.toFixed(2),
                    timeElapsed: timeElapsed.toFixed(2),
                    title: productData.title,
                    price: productData.price,
                    rating: productData.rating,
                    url: productData.url,
                    image: productData.image
                });
            } else {
                console.warn(`No valid product at X=${x}, Y=${y}`);
            }
        }

        console.log("Starting gaze data collection...");

        const gazeCollectionInterval = setInterval(() => {
            webgazer.getCurrentPrediction().then(async gaze => {
                if (gaze) {
                    await recordGazeData(gaze.x, gaze.y, performance.now());
                }
            }).catch(err => {
                console.warn("Gaze prediction error:", err);
            });
        }, 500);

        setTimeout(() => {
            clearInterval(gazeCollectionInterval);
            console.log("Gaze tracking complete. Downloading data...");
            downloadCSV();
        }, 600000);

        function downloadCSV() {
            if (gazeData.length === 0) {
                console.warn("No gaze data collected!");
                return;
            }

            let csvContent = "x,y,timeElapsed,Title,Price,Rating,URL,Image\n";
            gazeData.forEach(row => {
                csvContent += `${row.x},${row.y},${row.timeElapsed},"${row.title}","${row.price}","${row.rating}","${row.url}","${row.image}"\n`;
            });

            const blob = new Blob([csvContent], { type: "text/csv" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "gaze_product_data.csv";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
})();
*/
