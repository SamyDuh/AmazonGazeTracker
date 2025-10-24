console.log("popup.js loaded");

document.addEventListener('DOMContentLoaded', () => {
    const selectionField = document.getElementById("test-time");
    const button = document.getElementById("confirm-button");


    function retrieveSelection() {
        const selection = selectionField.options[selectionField.selectedIndex];
        return selection.value;
    }

    button.addEventListener('click', () => {
        const selection = retrieveSelection();
        chrome.storage.sync.set({ selection });
    });

});
