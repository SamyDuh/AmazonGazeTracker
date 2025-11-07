chrome.runtime.onInstalled.addListener(() => {
    console.log("Amazon Gaze Tracker Extension Installed");
});

chrome.action.onClicked.addListener((tab) => {
  console.log("Calibration Stage Triggered");
  chrome.tabs.sendMessage(tab.id, { action: "startCalibration" });
});
