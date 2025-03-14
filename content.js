console.log("Amazon Gaze Tracker Extension Loaded");

(async function() {
    console.log("Initializing SearchGazer...");

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('searchgazer.js');
    document.head.appendChild(script);

    script.onload = function() {
        console.log("SearchGazer Loaded. Initializing...");

        webgazer.setTracker('TFFacemesh')
                .setRegression('ridge')
                .showVideoPreview(true)
                .showFaceOverlay(true)
                .showFaceFeedbackBox(true)
                .showPredictionPoints(true)
                .begin();

        let gazeData = [];

        function getProductDetails(x, y) {
            let element = document.elementFromPoint(x, y);
            if (!element) {
                console.warn(`No element found at X=${x}, Y=${y}`);
                return null;
            }

            console.log(`Detected Element at X=${x}, Y=${y}:`, element);

            // Traverse upwards to find the nearest product container
            let productElement = element.closest('.octopus-pc-item');

            if (!productElement) {
                console.warn(`No valid product found at X=${x}, Y=${y}`);
                return null;
            }

            console.log("Found product container:", productElement);

            const titleElement = productElement.querySelector('.octopus-pc-asin-title span');
            const priceElement = productElement.querySelector('.a-price .a-offscreen');
            const ratingElement = productElement.querySelector('.a-icon-alt');
            const urlElement = productElement.querySelector('a.octopus-pc-item-link');
            const imageElement = productElement.querySelector('img.octopus-pc-item-image');

            return {
                title: titleElement ? titleElement.innerText.trim() : "N/A",
                price: priceElement ? priceElement.innerText.trim() : "N/A",
                rating: ratingElement ? ratingElement.innerText.trim() : "N/A",
                url: urlElement ? "https://www.amazon.com" + urlElement.getAttribute("href") : "N/A",
                image: imageElement ? imageElement.src : "N/A"
            };
        }

        function recordGazeData(x, y, timeElapsed) {
            const productData = getProductDetails(x, y);
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
            webgazer.getCurrentPrediction().then(gaze => {
                if (gaze) {
                    recordGazeData(gaze.x, gaze.y, performance.now());
                }
            }).catch(err => {
                console.warn("Gaze prediction error:", err);
            });
        }, 500);

        // Stop tracking and download CSV after 10 minutes
        setTimeout(() => {
            clearInterval(gazeCollectionInterval);
            console.log("Gaze tracking complete. Downloading data...");
            downloadCSV();
        }, 60000);

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