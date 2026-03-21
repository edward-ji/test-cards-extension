// Firefox background script: open sidebar when user clicks the toolbar icon
browser.action.onClicked.addListener(() => {
  browser.sidebarAction.open().catch((error) => console.error(error));
});
