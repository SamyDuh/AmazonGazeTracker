# Amazon Gaze Tracker Extension

Tracks user gaze on Amazon product pages and logs product interactions.<br>

Works only on this page:<br>
https://www.amazon.com/Childrens-Books/b/?ie=UTF8&node=4&ref_=sv_b_6<br>

## Installation
1. Clone the repo using the following command on your command prompt:


    git clone https://github.com/imvk14153/AmazonGazeTracker.git

2. Load as an Unpacked Extension in Chrome<br>
        - Open Google Chrome and navigate to chrome://extensions/<br>
        - Enable Developer mode.<br>
        - Click Load unpacked and select the AmazonGazeTracker folder.<br>
        - The extension should now appear in your extensions list.<br>

## How It Works
1. Visit the Amazon page: https://www.amazon.com/Childrens-Books/b/?ie=UTF8&node=4&ref_=sv_b_6<br>
2. The extension tracks your gaze movements and detects the products you view.
3. After 10 minutes, the gaze data is automatically downloaded as a CSV file.