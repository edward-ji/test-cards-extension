export default defineBackground(() => {
  if (import.meta.env.BROWSER === 'chrome' || import.meta.env.BROWSER === 'edge') {
    // Allows users to open the side panel by clicking on the action toolbar icon
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  } else if (import.meta.env.BROWSER === 'firefox') {
    // Open sidebar when toolbar icon is clicked
    browser.action.onClicked.addListener(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (browser as any).sidebarAction.open().catch((error: unknown) => console.error(error));
    });
  }
});
