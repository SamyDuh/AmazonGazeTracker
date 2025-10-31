console.log("Amazon Gaze Tracker Extension Loaded");

//const testTime = chrome.storage.sync.get({ selection }) || 300000;

//console.log(testTime);

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

            let faceout = 
                element.closest('[data-component-type="s-search-result"][role="listitem"][data-asin]:not([data-asin=""])') ||
                element.closest(".a-carousel-card") || // for carousels
                element.closest(".feed-carousel-card") ||// for home screen feed
                element.closest('bds-unified-book-faceout[data-csa-c-item-type="asin"]') || // for childrens' books
                element.closest(".p13n-sc-uncoverable-faceout") || // recommended items
                element.closest(".p13n-desktop-sims-fbt") || // frequently bought together
                element.closest(".p13n-desktop-carousel") || // also viewed
                element.closest("#ppd, #dp-container"); // product detail container

            if (!faceout) return null;

            let title = "N/A", price = "N/A", rating = "N/A", image = "N/A", url = "N/A";

            try{
                // ---------- search result page ----------
                if (faceout.matches('[data-component-type="s-search-result"]')) {
                    title = faceout.querySelector("h2")?.textContent?.trim() || "N/A";
                    price = faceout.querySelector(".a-price .a-offscreen")?.textContent?.trim() || "N/A";
                    rating = faceout.querySelector(".a-icon-alt")?.textContent?.trim() || "N/A";
                    image = faceout.querySelector("img.s-image")?.src || "N/A";
                    const link = faceout.querySelector("h2 a");
                    if (link) url = "https://www.amazon.com" + link.getAttribute("href");
                }

                // ---------- product detail page ----------
                else if (faceout.matches("#ppd, #dp-container")) {
                    title = document.querySelector("#productTitle")?.textContent?.trim() || "N/A";
                    price = document.querySelector("#corePrice_feature_div .a-price .a-offscreen")?.textContent?.trim() || "N/A";
                    rating = document.querySelector("i.a-icon-star span.a-icon-alt")?.textContent?.trim() || "N/A";
                    image = document.querySelector("#imgTagWrapperId img")?.src || "N/A";
                    url = window.location.href;
                }

                // ---------- children's book page ----------
                else if (faceout.matches('bds-unified-book-faceout[data-csa-c-item-type="asin"]')) {
                    const faceShadow = faceout.shadowRoot; //gets shadowroot of bds-unified-book-faceout
                    title = faceShadow.querySelector('[aria-label]')?.getAttribute('aria-label') || 'N/A';
                    price = faceShadow.querySelector('bds-book-price')?.shadowRoot?.querySelector('.price-format-parts-wrapper')?.textContent?.replace(/\s+/g,'') || "N/A";
                    rating = faceShadow.querySelector('bds-star-rating')?.getAttribute('shortdisplaystring') || "N/A";
                    image = faceShadow.querySelector('bds-book-cover-image')?.shadowRoot?.querySelector('source[type="image/jpeg"]')
                    ?.getAttribute('srcset')?.split(',')[0].trim().split(/\s+/)[0] || "N/A"; //strips the srcset to only include the first field (the first src)
                    const href = faceShadow.querySelector("a")?.getAttribute('href');
                    if (href) url = "https://www.amazon.com" + href; //puts together the whole amazon link if an href was found

                }
                // ---------- carousel ----------
                else if (faceout.matches(".a-carousel-card")) {
                    title = faceout.querySelector("h2")?.textContent?.trim() ||
                            faceout.querySelector('div[role="heading"]')?.querySelector("a")?.getAttribute('title') ||
                            faceout.querySelector('.sponsored-products-truncator-afo-4, .sponsored-products-truncator-truncated, [data-rows][aria-hidden="true"]')?.textContent?.trim() ||
                            faceout.querySelector('img[alt]')?.getAttribute('alt') ||
                            "N/A";
                    price = faceout.querySelector(".a-price .a-offscreen")?.textContent?.trim() || "N/A";
                    rating = faceout.querySelector(".a-icon-alt")?.textContent?.trim() || 
                            faceout.querySelector('a[aria-label*="out of 5 stars"]')?.getAttribute('aria-label') ||
                            "N/A";
                    image = faceout.querySelector("img")?.src || "N/A";
                    url = ([...faceout.querySelectorAll('a[href]')].find(a => !a.getAttribute('href')?.startsWith('javascript') && (/\/dp\/|\/gp\/|\/sspa\/click/.test(a.getAttribute('href'))))?.href) || 
                    "N/A";
                    //else url = "N/A";
                }
                // ---------- home page carousel ----------
                else if (faceout.matches(".feed-carousel-card")) {
                    title = faceout.querySelector("img")?.getAttribute('alt') || "N/A";
                    price = "N/A"; // home page does not contain price information
                    rating = "N/A"; // home page does not contain ratings
                    image = faceout.querySelector("a")?.querySelector("img")?.src || "N/A";
                    const href = faceout.querySelector("a")?.getAttribute('href');
                    if (href) url = "https://www.amazon.com" + href;
                }

                // ---------- recommended products ----------
                else if(faceout.matches(".p13n-sc-uncoverable-faceout, .p13n-desktop-carousel, .p13n-desktop-sims-fbt")){
                    title = faceout.querySelector("img")?.alt ||
                            faceout.querySelector("h2, .a-size-base, .a-size-medium")?.textContent?.trim()|| "N/A";
                    price = faceout.querySelector(".a-price .a-offscreen")?.textContent?.trim() || "N/A";
                    rating = faceout.querySelector(".a-icon-alt")?.textContent?.trim() || "N/A";
                    image = faceout.querySelector("img")?.src || "N/A";
                    const link = faceout.querySelector("a[href*='/dp/']");
                    if (link) url = "https://www.amazon.com" + link.getAttribute("href");
                }

                // fallback - grab the ASIN (amazon standard identification number)
                // used to track products
                if (title == "N/A"){
                    const asin = faceout.getAttribute("data-asin");
                    if (asin) title = "ASIN: " +asin;
                }

            }
            catch (e){
                console.log("extraction error:", e);
            }
            //if (!faceout || !faceout.shadowRoot) return null;

            //const faceoutShadow = faceout.shadowRoot;

            // ---------- Title ----------
            /*try {
                const titleComp = faceoutShadow.querySelector("bds-book-title-content");
                const shadow1 = titleComp?.shadowRoot;
                const bookTitleContent = shadow1?.querySelector("div.bookTitleContent");
                const primaryText = bookTitleContent?.querySelector("div.primaryTextOnly");
                const a = primaryText?.querySelector("a");

                if (a && a.shadowRoot == null) {
                    const h3 = await waitForElement("h3", a, 1000);
                    title = h3?.innerText?.trim() || "N/A";
                }

               title = faceout.querySelector('h2')?.textContent?.trim()
               
               if (title != "N/A") console.log(title);

            } catch (e) {
                console.warn("Title extraction error:", e);
            }*/

            // ---------- Price ----------
            //let price = "N/A";
            /*try {
                const priceComponent = faceoutShadow.querySelector("bds-book-price");
                const priceShadow = priceComponent?.shadowRoot;
                const priceEl = priceShadow?.querySelector("span.offscreen");
                if (priceEl) price = priceEl.innerText.trim();
            } catch (e) {
                console.warn("Price extraction error:", e);
            }*/

            // ---------- Rating ----------
            //let rating = "N/A";
            /*try {
                const ratingComponent = faceoutShadow.querySelector("bds-star-rating");
                const ratingShadow = ratingComponent?.shadowRoot;
                const ratingEl = ratingShadow?.querySelector("span.rating");
                if (ratingEl) rating = ratingEl.innerText.trim();
            } catch (e) {
                console.warn("Rating extraction error:", e);
            }*/

            // ---------- Image ----------
            //let image = "N/A";
            /*try {
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
            }*/

            // ---------- URL ----------
            //let url = "N/A";
            /*try {
                const a = faceoutShadow.querySelector("a[href*='/dp/']");
                const href = a?.getAttribute("href");
                if (href) url = "https://www.amazon.com" + href;
            } catch (e) {
                console.warn("URL extraction error:", e);
            }*/

            console.log("Extracted product data:");
            console.log("Title:", title);
            console.log("Price:", price);
            console.log("Rating:", rating);
            console.log("Image:", image);
            console.log("URL:", url);

            return { title, price, rating, image, url };
        }

        // allows the dynamically added products to be observed
        const observer = new MutationObserver(()=>{
            console.log("new recommended products loaded");
        });
        observer.observe(document.body, {childList: true, subtree: true});

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
        }, 30000);

        function escapeCSV(value){
            if (value == null) return "";
            const safe = String(value).replace(/"/g, '""');
            return `"${safe}"`;
        }

        function downloadCSV() {
            if (gazeData.length === 0) {
                console.warn("No gaze data collected!");
                return;
            }

            let csvContent = "x,y,timeElapsed,Title,Price,Rating,URL,Image\n";
            gazeData.forEach(row => {
                csvContent += [
                    row.x, row.y, row.timeElapsed,
                    escapeCSV(row.title),
                    escapeCSV(row.price),
                    escapeCSV(row.rating),
                    escapeCSV(row.url),
                    escapeCSV(row.image)
                ].join(",") + "\n";
            });

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `gaze_product_data_${new Date().toISOString().slice(0, 10).replace(/[:T]/g, "-")}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
})();
