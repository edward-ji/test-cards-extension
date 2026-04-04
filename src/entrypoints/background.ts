export default defineBackground(() => {
  if (browser.sidePanel?.setPanelBehavior) {
    // Chrome/Edge: open side panel when toolbar icon is clicked
    browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) => console.error(error));
  } else {
    // Firefox: open sidebar when toolbar icon is clicked
    browser.action.onClicked.addListener(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (browser as any).sidebarAction.open().catch((error: unknown) => console.error(error));
    });
  }
});
