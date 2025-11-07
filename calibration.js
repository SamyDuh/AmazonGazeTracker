// calibration.js
console.log("calibration.js loaded");

// --- Calibration state --- //
let pointCalibrate = 0;
let calibrationPoints = {};
let isCalibrated = false;
let calibrationData = [];
let correctionModel = null;

// --- Create calibration overlay --- //
function createCalibrationUI() {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'calibration-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
        display: none;
    `;

    // 9 points
    const positions = [
        { id: 'Pt1', top: '10%', left: '10%' },
        { id: 'Pt2', top: '10%', left: '50%' },
        { id: 'Pt3', top: '10%', left: '90%' },
        { id: 'Pt4', top: '50%', left: '10%' },
        { id: 'Pt5', top: '50%', left: '50%' }, // center, show last
        { id: 'Pt6', top: '50%', left: '90%' },
        { id: 'Pt7', top: '90%', left: '10%' },
        { id: 'Pt8', top: '90%', left: '50%' },
        { id: 'Pt9', top: '90%', left: '90%' }
    ];

    positions.forEach(pos => {
        const point = document.createElement('button');
        point.id = pos.id;
        point.className = 'calibration-point';
        point.style.cssText = `
            position: absolute;
            top: ${pos.top};
            left: ${pos.left};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background-color: red;
            border: 2px solid white;
            cursor: pointer;
            opacity: 0.7;
            transform: translate(-50%, -50%);
            z-index: 10001;
        `;
        // Hide center initially
        if (pos.id === 'Pt5') point.style.display = 'none';

        point.addEventListener('click', () => handleCalibrationClick(point));
        overlay.appendChild(point);
    });

    // Instruction
    const instruction = document.createElement('div');
    instruction.id = 'calibration-instruction';
    instruction.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        font-size: 18px;
        font-family: Arial, sans-serif;
        text-align: center;
        z-index: 10001;
    `;
    instruction.innerHTML = 'Click each point 5 times. Points will turn yellow when complete.';
    overlay.appendChild(instruction);

    document.body.appendChild(overlay);
}

// --- Handle calibration point clicks --- //
function handleCalibrationClick(point) {
    const id = point.id;

    if (!calibrationPoints[id]) calibrationPoints[id] = 0;
    calibrationPoints[id]++;

    // Apply opacity or turn yellow when complete
    if (calibrationPoints[id] >= 5) {
        point.style.backgroundColor = 'yellow';
        point.disabled = true;
        pointCalibrate++;
    } else {
        const opacity = 0.2 * calibrationPoints[id] + 0.2;
        point.style.opacity = opacity;
    }

    // Record SearchGazer prediction for this click
    if (window.webgazer && window.webgazer.getCurrentPrediction) {
        window.webgazer.getCurrentPrediction().then(pred => {
            if (pred) {
                const rect = point.getBoundingClientRect();
                calibrationData.push({
                    actualX: rect.left + rect.width / 2,
                    actualY: rect.top + rect.height / 2,
                    predictedX: pred.x,
                    predictedY: pred.y
                });
            }
        }).catch(err => console.warn("Prediction error:", err));
    }

    // Show center point after 8 points
    if (pointCalibrate === 8) {
        document.getElementById('Pt5').style.display = 'block';
    }

    // Finish calibration after all 9 points
    if (pointCalibrate >= 9) finishCalibration();
}

// --- Finish calibration --- //
function finishCalibration() {
    const overlay = document.getElementById('calibration-overlay');
    if (overlay) overlay.style.display = 'none';
    isCalibrated = true;

    // Compute simple correction model
    const avgDx = avg(calibrationData.map(p => p.actualX - p.predictedX));
    const avgDy = avg(calibrationData.map(p => p.actualY - p.predictedY));
    correctionModel = { dx: avgDx, dy: avgDy };

    alert('Calibration complete! Eye tracking will now be more accurate.');
}

// --- Helpers --- //
function avg(arr) { return arr.reduce((a,b) => a+b, 0)/arr.length; }

// --- Get calibrated prediction --- //
function getCalibratedPrediction(pred) {
    if (!correctionModel || !pred) return pred;
    return { x: pred.x + correctionModel.dx, y: pred.y + correctionModel.dy };
}

// --- Start calibration globally --- //
window.startCalibration = function() {
    createCalibrationUI();
    const overlay = document.getElementById('calibration-overlay');
    if (!overlay) return;

    // Show overlay
    overlay.style.display = 'block';

    // Reset counters
    pointCalibrate = 0;
    calibrationPoints = {};
    calibrationData = [];

    console.log("Calibration started!");
};
