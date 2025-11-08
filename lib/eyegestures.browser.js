// Browser-compatible version of EyeGestures (without ES6 module exports)

// Helper function
const euclideanDistance = (a, b) => Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));

// CalibrationMatrix class
class CalibrationMatrix {
    constructor() {
        this.iterator = 0;
        this.points = [
            [0.25, 0.25], [0.5, 0.75], [1, 0.5], [0.75, 0.5], [0, 0.75],
            [0.5, 0.5], [1, 0.25], [0.75, 0], [0.25, 0.5], [0.5, 0],
            [0, 0.5], [1, 1], [0.75, 1], [0.25, 0], [1, 0],
            [0, 1], [0.25, 1], [0.75, 0.75], [0.5, 0.25], [0, 0.25],
            [1, 0.5], [0.75, 0.25], [0.5, 1], [0.25, 0.75], [0, 0]
        ];
    }

    updMatrix(points) {
        this.points = points;
        this.iterator = 0;
    }

    movePoint() {
        this.iterator = (this.iterator + 1) % this.points.length;
    }

    getCurrentPoint(width = 1, height = 1) {
        const point = this.points[this.iterator];
        return [point[0] * width, point[1] * height];
    }
}

// Calibrator class
class Calibrator {
    static PRECISION_LIMIT = 50;
    static PRECISION_STEP = 10;
    static ACCEPTANCE_RADIUS = 500;

    constructor(radius = 1000) {
        this.X = [];
        this.__tmp_X = [];
        this.Y_y = [];
        this.Y_x = [];
        this.__tmp_Y_y = [];
        this.__tmp_Y_x = [];
        this.reg = null;
        this.reg_x = null;
        this.reg_y = null;
        this.currentAlgorithm = "MLR";
        this.fitted = false;
        this.cvNotSet = true;
        this.matrix = new CalibrationMatrix();
        this.precisionLimit = Calibrator.PRECISION_LIMIT;
        this.precisionStep = Calibrator.PRECISION_STEP;
        this.acceptanceRadius = Math.floor(radius / 2);
        this.calibrationRadius = Math.floor(radius);
    }

    add(features, target) {
        features = [].concat(features.flat());
        this.__tmp_X.push(features);
        this.__tmp_Y_y.push([target[0]]);
        this.__tmp_Y_x.push([target[1]]);
        
        if (this.__tmp_Y_y.length > 40) {
            this.__tmp_Y_y.shift();
            this.__tmp_Y_x.shift();
            this.__tmp_X.shift();
        }
        
        console.log(ML);
        this.reg_x = new ML.MultivariateLinearRegression(
            [].concat(this.__tmp_X, this.X),
            [].concat(this.__tmp_Y_y, this.Y_y)
        );
        this.reg_y = new ML.MultivariateLinearRegression(
            [].concat(this.__tmp_X, this.X),
            [].concat(this.__tmp_Y_x, this.Y_x)
        );
        this.fitted = true;
    }

    predict(features) {
        if (!this.fitted) {
            return [0, 0];
        }
        features = [].concat(features.flat());
        return [this.reg_x.predict(features)[0], this.reg_y.predict(features)[0]];
    }

    movePoint() {
        this.matrix.movePoint();
        this.Y_y = this.Y_y.concat(this.__tmp_Y_y);
        this.Y_x = this.Y_x.concat(this.__tmp_Y_x);
        this.X = this.X.concat(this.__tmp_X);
        this.__tmp_X = [];
        this.__tmp_Y_y = [];
        this.__tmp_Y_x = [];
    }

    getCurrentPoint(width, height) {
        return this.matrix.getCurrentPoint(width, height);
    }

    updMatrix(points) {
        return this.matrix.updMatrix(points);
    }

    unfit() {
        this.acceptanceRadius = Calibrator.ACCEPTANCE_RADIUS;
        this.calibrationRadius = this.calibrationRadius;
        this.fitted = false;
        this.Y_y = [];
        this.Y_x = [];
        this.X = [];
    }
}

// EyeGestures class - exposed as global window.EyeGestures
window.EyeGestures = class EyeGestures {
    constructor(videoElement_ID, onGaze) {
        // Create blue gaze cursor
        const cursor = document.createElement('div');
        cursor.id = "cursor";
        cursor.style.cssText = `
            display: none;
            position: fixed;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(94, 23, 235, 0.6);
            border: 3px solid rgba(94, 23, 235, 0.9);
            pointer-events: none;
            z-index: 999999;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(cursor);
        
        // Create red calibration target cursor
        const calib_cursor = document.createElement('div');
        calib_cursor.id = "calib_cursor";
        calib_cursor.style.cssText = `
            display: none;
            position: fixed;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(255, 87, 87, 0.8);
            border: 5px solid rgba(255, 87, 87, 1);
            box-shadow: 0 0 30px rgba(255, 87, 87, 0.6), 0 0 60px rgba(255, 87, 87, 0.3);
            pointer-events: none;
            z-index: 999998;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(calib_cursor);

        const logoDiv = document.createElement('div');
        logoDiv.id = "logoDivEyeGestures";
        logoDiv.style.width = "200px";
        logoDiv.style.height = "60px";
        logoDiv.style.position = "fixed";
        logoDiv.style.bottom = "10px";
        logoDiv.style.right = "10px";
        logoDiv.style.zIndex = "9999";
        logoDiv.style.background = "black";
        logoDiv.style.borderRadius = "10px";
        logoDiv.style.display = "none";
        logoDiv.onclick = function() {
            window.location.href = "https://eyegestures.com/";
        };
        const logo = document.createElement('div');
        logo.style.margin = "10px";
        logo.innerHTML = '<img src="https://eyegestures.com/logoEyeGesturesNew.png" alt="Logo" width="120px">';
        logoDiv.appendChild(logo);
        const canvas = document.createElement('canvas');
        canvas.id = "output_canvas";
        canvas.width = "50"; 
        canvas.height = "50";
        canvas.style.margin = "5px";
        canvas.style.borderRadius = "10px";
        canvas.style.border = "none";
        canvas.style.background = "#222";
        logoDiv.appendChild(canvas);
        document.body.appendChild(logoDiv);
        
        document.body.appendChild(calib_cursor);
        
        this.calibrator = new Calibrator;
        this.screen_width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        this.screen_height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        this.prev_calib = [0.0,0.0];
        this.head_starting_pos = [0.0,0.0];
        this.calib_counter = 0;
        this.calib_max = 25;
        this.counter = 0;
        this.collected_points = 0;  
        this.buffor = [];
        this.buffor_max = 20;
        this.start_width = 0;
        this.start_height = 0;
        this.onGaze = onGaze;

        this.run = false;
        this.__invisible = false;

        if (window.isSecureContext) {
            this.init(videoElement_ID);
        }
        else {
            console.error('This application requires a secure context (HTTPS or localhost)');
        }
    }

    showCalibrationInstructions(onRead) {
        const overlay = document.createElement('div');
        overlay.id = 'calibrationOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';

        const content = document.createElement('div');
        content.style.textAlign = 'center';
        content.style.color = '#fff';
        content.style.fontFamily = 'Arial, sans-serif';

        const instructionText1 = document.createElement('h3');
        instructionText1.textContent = 'EyeGestures Calibration:';
        instructionText1.style.fontSize = '1.5rem';
        instructionText1.style.marginBottom = '20px';

        const instructionText2 = document.createElement('p');
        instructionText2.innerHTML = 'To calibrate properly you need to gaze on <span style="color: #ff5757; font-weight: bold;">25 red circles</span>.';
        instructionText2.style.marginBottom = '20px';
        
        const instructionText3 = document.createElement('p');
        instructionText3.innerHTML = 'The <span style="color: #5e17eb; font-weight: bold;">blue circle</span> is your estimated gaze. With every calibration point, the tracker will gradually listen more and more to your gaze.';
        instructionText3.style.marginBottom = '20px';

        const button = document.createElement('button');
        button.textContent = 'Continue';
        button.style.padding = '10px 20px';
        button.style.fontSize = '1rem';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.backgroundColor = '#5e17eb';
        button.style.color = '#fff';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => {
            document.body.removeChild(overlay);
            onRead();
        });
        
        content.appendChild(instructionText1);
        content.appendChild(instructionText2);
        content.appendChild(instructionText3);
        content.appendChild(button);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
                onRead();
            }
        }, 15000);
    }

    updateStatus(message) {
        const statusEl = document.getElementById('gaze-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
        console.log('EyeGestures Status:', message);
    }

    showError(message) {
        const errorElement = document.getElementById('gaze-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        console.error('EyeGestures Error:', message);
    }

    loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async init(videoElement_id) {
        try {
            this.updateStatus('Loading MediaPipe library...');
            
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js');
            await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js');
            
            this.updateStatus('MediaPipe library loaded, initializing...');
            
            if (typeof FaceMesh === 'undefined') {
                throw new Error('FaceMesh is not defined. Library not loaded correctly.');
            }

            await this.setupMediaPipe(videoElement_id);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Initialization error: ' + error.message);
        }
    }

    async setupMediaPipe(videoElement_id) {
        try {
            const faceMesh = new FaceMesh({
                locateFile: (file) => {
                    console.log("Loading file:", file);
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
                }
            });

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            await faceMesh.initialize();
            this.updateStatus('FaceMesh initialized successfully');

            faceMesh.onResults(this.onFaceMeshResults.bind(this));

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {} 
            });
            
            const videoElement = document.getElementById(videoElement_id);
            videoElement.srcObject = stream;

            const self = this;
            videoElement.onloadeddata = () => {
                self.updateStatus('Video stream started');
                videoElement.play();
                requestAnimationFrame(processFrame);
            };

            function processFrame() {
                const videoElement = document.getElementById(videoElement_id);
                if (videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
                    requestAnimationFrame(processFrame);
                    return;
                }

                const canvas = document.getElementById("output_canvas");
                const ctx = canvas.getContext("2d");
                try {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);
                    faceMesh.send({ image: videoElement });
                    ctx.restore();
                } catch (error) {
                    console.error('Error processing frame:', error);
                    self.showError('Error processing frame: ' + error.message);
                }
                requestAnimationFrame(processFrame);
            }
        } catch (error) {
            console.error('Error initializing MediaPipe:', error);
            this.showError('Error initializing MediaPipe: ' + error.message);
        }
    }

    onFaceMeshResults(results) {
        const LEFT_EYE_KEYPOINTS = [
            33, 133, 160, 159, 158, 157, 173, 155, 154, 153, 144, 145, 153, 246, 468
        ];
        const RIGHT_EYE_KEYPOINTS = [
            362, 263, 387, 386, 385, 384, 398, 382, 381, 380, 374, 373, 374, 466, 473
        ];
        let offset_x = 0;
        let offset_y = 0;
        let width = 0;
        let height = 0;
        let max_x = 0;
        let max_y = 0;
        let left_eye_coordinates = [];
        let right_eye_coordinates = [];
        
        if (results.multiFaceLandmarks && this.run) {
            const canvas = document.getElementById("output_canvas");
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (var landmarks of results.multiFaceLandmarks) {
                offset_x = landmarks[0].x;
                offset_y = landmarks[1].y;

                landmarks.forEach(landmark => {
                    offset_x = Math.min(offset_x, landmark.x);
                    offset_y = Math.min(offset_y, landmark.y);
                    max_x = Math.max(max_x, landmark.x);
                    max_y = Math.max(max_y, landmark.y);
                });

                width = max_x - offset_x;
                height = max_y - offset_y;

                if (this.start_width * this.start_height == 0) {
                    this.start_width = width;
                    this.start_height = height;
                }

                let scale_x = width / this.start_width;
                let scale_y = height / this.start_height;

                let l_landmarks = LEFT_EYE_KEYPOINTS.map(index => landmarks[index]);
                let r_landmarks = RIGHT_EYE_KEYPOINTS.map(index => landmarks[index]);

                ctx.fillStyle = '#ff5757';
                l_landmarks.forEach(landmark => {
                    left_eye_coordinates.push([
                        (((landmark.x - offset_x) / width) * scale_x),
                        (((landmark.y - offset_y) / height) * scale_y)
                    ]);
                    ctx.beginPath();
                    ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, 2 * Math.PI);
                    ctx.fill();
                });

                ctx.fillStyle = '#5e17eb';
                r_landmarks.forEach(landmark => {
                    right_eye_coordinates.push([
                        (((landmark.x - offset_x) / width) * scale_x),
                        (((landmark.y - offset_y) / height) * scale_y)
                    ]);
                    ctx.beginPath();
                    ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 3, 0, 2 * Math.PI);
                    ctx.fill();
                });

                this.processKeyPoints(
                    left_eye_coordinates,
                    right_eye_coordinates,
                    offset_x * scale_x,
                    offset_y * scale_x,
                    scale_x,
                    scale_y,
                    width,
                    height
                );
            }
        }
    }

    processKeyPoints(left_eye_coordinates, right_eye_coordinates, offset_x, offset_y, scale_x, scale_y, width, height) {
        let keypoints = left_eye_coordinates;
        keypoints = keypoints.concat(right_eye_coordinates);
        keypoints = keypoints.concat([[scale_x, scale_y]]);
        keypoints = keypoints.concat([[width, height]]);
        
        if (this.head_starting_pos[0] == 0.0 && this.head_starting_pos[1] == 0.0) {
            this.head_starting_pos[0] = offset_x;
            this.head_starting_pos[1] = offset_y;
        }

        keypoints = keypoints.concat([[
            offset_x - this.head_starting_pos[0],
            offset_y - this.head_starting_pos[1]
        ]]);
        
        let calibration = this.calib_counter < this.calib_max;
        let calibration_point = [0.0, 0.0];
        let point = this.calibrator.predict(keypoints);
        
        this.buffor.push(point);
        if (this.buffor_max < this.buffor.length) {
            this.buffor.shift();
        }
        
        let average_point = [0, 0];
        if (this.buffor.length > 0) {
            average_point = this.buffor.reduce(
                (sum, current) => [sum[0] + current[0], sum[1] + current[1]],
                [0, 0]
            ).map(coord => coord / this.buffor.length);
        }
        point = average_point;

        if (calibration) {
            calibration_point = this.calibrator.getCurrentPoint(this.screen_width, this.screen_height);
            this.calibrator.add(keypoints, calibration_point);
            
            if (euclideanDistance(point, calibration_point) < 0.1 * this.screen_width && this.counter > 20) {
                this.calibrator.movePoint();
                this.counter = 0;
            } else if (euclideanDistance(point, calibration_point) < 0.1 * this.screen_width) {
                this.counter = this.counter + 1;
            }

            if (this.prev_calib[0] != calibration_point[0] || this.prev_calib[1] != calibration_point[1]) {
                this.prev_calib = calibration_point;
                this.calib_counter = this.calib_counter + 1;
            }
        } else {
            let calib_cursor = document.getElementById("calib_cursor");
            calib_cursor.style.display = "None";
        }

        let cursor = document.getElementById("cursor");
        let left = Math.min(Math.max(point[0], 0), this.screen_width);
        let top = Math.min(Math.max(point[1], 0), this.screen_height);
        cursor.style.left = `${left - 25}px`;
        cursor.style.top = `${top - 25}px`;
        
        // Position calibration cursor with bounds checking to prevent off-screen
        let calib_cursor = document.getElementById("calib_cursor");
        const calibSize = 40; // Half of the 80px width/height for centering
        const margin = 50; // Minimum margin from screen edge
        let calibLeft = Math.min(Math.max(this.prev_calib[0], margin), this.screen_width - margin);
        let calibTop = Math.min(Math.max(this.prev_calib[1], margin), this.screen_height - margin);
        calib_cursor.style.left = `${calibLeft}px`;
        calib_cursor.style.top = `${calibTop}px`;

        this.onGaze(point, calibration);
    }

    __run() {
        this.run = true;
    }

    start() {
        const logoDivEyeGestures = document.getElementById("logoDivEyeGestures");
        logoDivEyeGestures.style.display = "flex";

        this.showCalibrationInstructions(this.__run.bind(this));

        if (!this.__invisible) {
            let cursor = document.getElementById("cursor");
            cursor.style.display = "block";
        }

        let calib_cursor = document.getElementById("calib_cursor");
        calib_cursor.style.display = "block";
    }

    invisible() {
        this.__invisible = true;
        let cursor = document.getElementById("cursor");
        cursor.style.display = "none";
    }

    visible() {
        this.__invisible = false;
        let cursor = document.getElementById("cursor");
        cursor.style.display = "block";
    }

    stop() {
        this.run = false;
        console.log("stop");
    }

    recalibrate() {
        this.calibrator.unfit();
        this.calib_counter = 0;
    }
};

console.log('EyeGestures browser library loaded successfully');
console.log('window.EyeGestures:', window.EyeGestures);
