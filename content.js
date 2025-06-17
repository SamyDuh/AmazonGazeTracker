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
